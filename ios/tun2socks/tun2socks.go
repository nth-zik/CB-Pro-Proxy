package main

/*
#include <stdint.h>
*/
import "C"

import (
	"bufio"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/eycorsican/go-tun2socks/core"
	"github.com/eycorsican/go-tun2socks/proxy/dnsfallback"
	"github.com/eycorsican/go-tun2socks/proxy/socks"
	"golang.org/x/net/proxy"
)

var (
	stateMu     sync.Mutex
	running     bool
	outputQueue chan []byte
	stopCh      chan struct{}
	lwipStack   core.LWIPStack
)

func init() {
	debug.SetGCPercent(10)
	ticker := time.NewTicker(time.Minute)
	go func() {
		for range ticker.C {
			debug.FreeOSMemory()
		}
	}()
}

//export Tun2SocksStart
func Tun2SocksStart(proxyType *C.char, host *C.char, port C.int, username *C.char, password *C.char) (result C.int) {
	defer func() {
		if recover() != nil {
			result = -9
		}
	}()
	stateMu.Lock()
	defer stateMu.Unlock()

	if running {
		return 0
	}

	if proxyType == nil || host == nil || port <= 0 {
		return -1
	}

	proxyTypeStr := strings.ToLower(C.GoString(proxyType))
	hostStr := C.GoString(host)
	userStr := cStringOrEmpty(username)
	passStr := cStringOrEmpty(password)

	outputQueue = make(chan []byte, 2048)
	stopCh = make(chan struct{})

	stack, err := configureStack(proxyTypeStr, hostStr, int(port), userStr, passStr)
	if err != nil {
		outputQueue = nil
		stopCh = nil
		return -2
	}

	lwipStack = stack
	running = true
	return 0
}

//export Tun2SocksStop
func Tun2SocksStop() {
	defer func() {
		_ = recover()
	}()
	stateMu.Lock()
	defer stateMu.Unlock()

	if !running {
		return
	}

	running = false
	if stopCh != nil {
		close(stopCh)
	}
	stopCh = nil
	outputQueue = nil
	if lwipStack != nil {
		_ = lwipStack.Close()
		lwipStack = nil
	}
}

//export Tun2SocksInput
func Tun2SocksInput(data *C.uint8_t, length C.int) (result C.int) {
	defer func() {
		if recover() != nil {
			result = 0
		}
	}()
	stateMu.Lock()
	queue := outputQueue
	stack := lwipStack
	isRunning := running
	stateMu.Unlock()

	if !isRunning || data == nil || length <= 0 || stack == nil {
		return 0
	}

	packet := C.GoBytes(unsafe.Pointer(data), length)
	if _, err := stack.Write(packet); err != nil {
		_ = err
	}

	if queue == nil {
		return 0
	}

	return 1
}

//export Tun2SocksReadPacket
func Tun2SocksReadPacket(buffer *C.uint8_t, bufferLen C.int) (result C.int) {
	defer func() {
		if recover() != nil {
			result = 0
		}
	}()
	stateMu.Lock()
	queue := outputQueue
	stop := stopCh
	isRunning := running
	stateMu.Unlock()

	if !isRunning || buffer == nil || bufferLen <= 0 || queue == nil {
		return 0
	}

	select {
	case packet := <-queue:
		out := unsafe.Slice((*byte)(unsafe.Pointer(buffer)), int(bufferLen))
		count := copy(out, packet)
		return C.int(count)
	case <-stop:
		return 0
	default:
		return 0
	}
}

func configureStack(proxyType string, host string, port int, username string, password string) (core.LWIPStack, error) {
	core.RegisterOutputFn(func(data []byte) (int, error) {
		stateMu.Lock()
		queue := outputQueue
		stateMu.Unlock()

		if queue == nil {
			return 0, nil
		}

		packet := make([]byte, len(data))
		copy(packet, data)

		select {
		case queue <- packet:
		default:
		}

		return len(data), nil
	})

	stack := core.NewLWIPStack()

	switch proxyType {
	case "socks5", "socks":
		core.RegisterTCPConnHandler(newSocksTCPHandler(host, uint16(port), username, password))
		if username == "" && password == "" {
			core.RegisterUDPConnHandler(socks.NewUDPHandler(host, uint16(port), 30*time.Second))
		} else {
			core.RegisterUDPConnHandler(dnsfallback.NewUDPHandler())
		}
	case "http", "https":
		core.RegisterTCPConnHandler(newHTTPConnectHandler(host, uint16(port), username, password))
		core.RegisterUDPConnHandler(dnsfallback.NewUDPHandler())
	default:
		return nil, errors.New("unsupported proxy type")
	}

	return stack, nil
}

type socksTCPHandler struct {
	proxyHost string
	proxyPort uint16
	auth      *proxy.Auth
}

func newSocksTCPHandler(host string, port uint16, username string, password string) core.TCPConnHandler {
	var auth *proxy.Auth
	if username != "" || password != "" {
		auth = &proxy.Auth{User: username, Password: password}
	}

	return &socksTCPHandler{
		proxyHost: host,
		proxyPort: port,
		auth:      auth,
	}
}

func (h *socksTCPHandler) Handle(conn net.Conn, target *net.TCPAddr) error {
	if target == nil {
		return errors.New("missing target address")
	}
	proxyAddr := net.JoinHostPort(h.proxyHost, strconv.Itoa(int(h.proxyPort)))
	dialer, err := proxy.SOCKS5("tcp", proxyAddr, h.auth, proxy.Direct)
	if err != nil {
		return err
	}

	c, err := dialer.Dial(target.Network(), target.String())
	if err != nil {
		return err
	}

	go relayTCP(conn, c)
	return nil
}

type httpConnectHandler struct {
	proxyHost string
	proxyPort uint16
	username  string
	password  string
}

func newHTTPConnectHandler(host string, port uint16, username string, password string) core.TCPConnHandler {
	return &httpConnectHandler{
		proxyHost: host,
		proxyPort: port,
		username:  username,
		password:  password,
	}
}

func (h *httpConnectHandler) Handle(conn net.Conn, target *net.TCPAddr) error {
	if target == nil {
		return errors.New("missing target address")
	}
	proxyAddr := net.JoinHostPort(h.proxyHost, strconv.Itoa(int(h.proxyPort)))
	proxyConn, err := net.DialTimeout("tcp", proxyAddr, 10*time.Second)
	if err != nil {
		return err
	}

	targetAddr := target.String()
	req := fmt.Sprintf("CONNECT %s HTTP/1.1\r\nHost: %s\r\n", targetAddr, targetAddr)
	if h.username != "" || h.password != "" {
		token := base64.StdEncoding.EncodeToString([]byte(h.username + ":" + h.password))
		req += "Proxy-Authorization: Basic " + token + "\r\n"
	}
	req += "\r\n"

	if _, err := io.WriteString(proxyConn, req); err != nil {
		proxyConn.Close()
		return err
	}

	reader := bufio.NewReader(proxyConn)
	code, err := readHTTPStatusCode(reader)
	if err != nil {
		proxyConn.Close()
		return err
	}
	if code < 200 || code >= 300 {
		proxyConn.Close()
		return fmt.Errorf("proxy connect failed with status %d", code)
	}

	buffered := &bufferedConn{Conn: proxyConn, reader: reader}
	go relayTCP(conn, buffered)
	return nil
}

func readHTTPStatusCode(reader *bufio.Reader) (int, error) {
	statusLine, err := reader.ReadString('\n')
	if err != nil {
		return 0, err
	}

	statusLine = strings.TrimSpace(statusLine)
	parts := strings.SplitN(statusLine, " ", 3)
	if len(parts) < 2 {
		return 0, errors.New("invalid proxy response")
	}

	code, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, err
	}

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return 0, err
		}
		if line == "\r\n" {
			break
		}
	}

	return code, nil
}

type bufferedConn struct {
	net.Conn
	reader *bufio.Reader
}

func (c *bufferedConn) Read(p []byte) (int, error) {
	return c.reader.Read(p)
}

func (c *bufferedConn) CloseRead() error {
	if cr, ok := c.Conn.(interface{ CloseRead() error }); ok {
		return cr.CloseRead()
	}
	return nil
}

func (c *bufferedConn) CloseWrite() error {
	if cw, ok := c.Conn.(interface{ CloseWrite() error }); ok {
		return cw.CloseWrite()
	}
	return nil
}

type direction byte

type duplexConn interface {
	net.Conn
	CloseRead() error
	CloseWrite() error
}

const (
	dirUplink direction = iota
	dirDownlink
)

func relayTCP(lhs, rhs net.Conn) {
	upCh := make(chan struct{})

	cls := func(dir direction, interrupt bool) {
		lhsDConn, lhsOk := lhs.(duplexConn)
		rhsDConn, rhsOk := rhs.(duplexConn)
		if !interrupt && lhsOk && rhsOk {
			switch dir {
			case dirUplink:
				lhsDConn.CloseRead()
				rhsDConn.CloseWrite()
			case dirDownlink:
				lhsDConn.CloseWrite()
				rhsDConn.CloseRead()
			default:
				return
			}
		} else {
			lhs.Close()
			rhs.Close()
		}
	}

	go func() {
		_, err := io.Copy(rhs, lhs)
		if err != nil {
			cls(dirUplink, true)
		} else {
			cls(dirUplink, false)
		}
		upCh <- struct{}{}
	}()

	_, err := io.Copy(lhs, rhs)
	if err != nil {
		cls(dirDownlink, true)
	} else {
		cls(dirDownlink, false)
	}

	<-upCh
}

func cStringOrEmpty(value *C.char) string {
	if value == nil {
		return ""
	}
	return C.GoString(value)
}

func main() {}
