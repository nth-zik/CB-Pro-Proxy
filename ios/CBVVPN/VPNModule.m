#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(VPNModule, RCTEventEmitter)

// Profile Management
RCT_EXTERN_METHOD(getProfiles:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(saveProfile:(NSString *)name
                  host:(NSString *)host
                  port:(nonnull NSNumber *)port
                  type:(NSString *)type
                  username:(NSString *)username
                  password:(NSString *)password
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(deleteProfile:(NSString *)profileId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// VPN Control
RCT_EXTERN_METHOD(startVPN:(NSString *)profileId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startVPNWithProfile:(NSString *)name
                  host:(NSString *)host
                  port:(nonnull NSNumber *)port
                  type:(NSString *)type
                  username:(NSString *)username
                  password:(NSString *)password
                  dns1:(NSString *)dns1
                  dns2:(NSString *)dns2
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopVPN:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(refreshStatus)

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

@end
