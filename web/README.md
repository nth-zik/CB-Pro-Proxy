# CB Pro Proxy - Privacy & Terms Website

Simple, clean website hosting Privacy Policy and Terms & Conditions for CB Pro Proxy app.

## 📁 Structure

```
web/
├── index.html          # Landing page with links
├── privacy.html        # Privacy Policy
├── terms.html          # Terms & Conditions
├── firebase.json       # Firebase Hosting config
├── .firebaserc         # Firebase project config
└── README.md          # This file
```

## 🚀 Deploy to Firebase

### 1. Install Firebase CLI (if not installed)

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

### 3. Initialize Firebase project (first time only)

```bash
cd web
firebase init hosting
# Select existing project or create new one
# Select "web" as public directory
# Configure as single-page app: No
# Set up automatic builds: No
```

### 4. Update `.firebaserc` with your project ID

Edit `.firebaserc` and replace `your-project-id` with your actual Firebase project ID.

### 5. Deploy

```bash
firebase deploy --only hosting
```

## 🔗 Usage

After deployment, your site will be available at:

- `https://your-project-id.web.app`
- `https://your-project-id.firebaseapp.com`

### Play Store URLs

Use these URLs in Google Play Console:

- **Privacy Policy**: `https://your-project-id.web.app/privacy.html`
- **Terms & Conditions**: `https://your-project-id.web.app/terms.html`

## 🎨 Design

- Clean, modern UI with gradient background
- Responsive design (mobile & desktop)
- Professional typography (Inter font)
- Glass-morphism effects
- Smooth animations

## 📝 Update Content

To update privacy policy or terms:

1. Edit `privacy.html` or `terms.html`
2. Run `firebase deploy --only hosting`
3. Changes go live immediately

## 💡 Custom Domain (Optional)

To use custom domain (e.g., `policy.yourapp.com`):

```bash
firebase hosting:channel:deploy custom-domain
```

Then follow Firebase Console instructions to add domain.

## 📧 Contact

Questions? Contact: ngtanhung41@gmail.com
