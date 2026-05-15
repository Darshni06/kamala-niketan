# 🪷 Kamala Niketan — Complete Deployment Guide
### For Non-Technical Users | Step-by-Step

---

## OVERVIEW — What You'll Set Up

| Service | What It Does | Cost |
|---------|-------------|------|
| **Firebase** | Stores all data + handles login | Free |
| **GitHub** | Holds your code safely | Free |
| **Vercel** | Makes the website live on the internet | Free |
| **Google AI Studio** | Powers AI report card narratives | Free |

Total cost: **₹0** for your school's scale.

---

## PART 1 — Firebase Setup (Database + Login)
*Time needed: ~15 minutes*

### Step 1.1 — Create a Firebase account

1. Open your browser and go to: **https://firebase.google.com**
2. Click the blue **"Get started"** button
3. Sign in with a Google account (use the school's Google account if possible)

---

### Step 1.2 — Create a new project

1. Click **"Create a project"**
2. Project name: type **`kamala-niketan`**
3. Click **Continue**
4. On the "Google Analytics" screen → toggle it **OFF** → click **Create project**
5. Wait ~30 seconds → click **Continue**

You're now in the Firebase Console for your project.

---

### Step 1.3 — Enable Email/Password login

1. In the left sidebar, click **"Authentication"**
2. Click **"Get started"**
3. Under "Sign-in method", click **"Email/Password"**
4. Toggle the first switch **ON** (Email/Password)
5. Click **Save**

---

### Step 1.4 — Create the database

1. In the left sidebar, click **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in production mode"** → click **Next**
4. Choose location: **`asia-south1 (Mumbai)`** → click **Enable**
5. Wait ~1 minute for it to set up

---

### Step 1.5 — Set database security rules

1. In Firestore, click the **"Rules"** tab at the top
2. Delete ALL the existing text in the rules editor
3. Copy and paste the entire contents of the file `firestore.rules` from your project folder
4. Click **"Publish"**

---

### Step 1.6 — Get your Firebase config keys

1. Click the **gear icon ⚙️** at the top left → **"Project settings"**
2. Scroll down to **"Your apps"** section
3. Click the **`</>`** (web) icon
4. App nickname: type **`kamala-niketan-web`** → click **Register app**
5. You will see a block of code like this:

```
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "kamala-niketan.firebaseapp.com",
  projectId: "kamala-niketan",
  storageBucket: "kamala-niketan.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

6. **IMPORTANT:** Copy these values — you'll need them in Part 3.
7. Click **Continue to console**

---

### Step 1.7 — Create the first Admin account

1. In Firebase Console, click **"Authentication"** in the left sidebar
2. Click **"Add user"**
3. Email: `latha.s@kamalaniketan.com`
4. Password: choose a strong password (write it down safely)
5. Click **Add user**
6. Copy the **User UID** shown (the long string like `abc123xyz...`) — you'll need it next

---

### Step 1.8 — Set the Admin role in database

1. Click **"Firestore Database"** in left sidebar
2. Click **"+ Start collection"**
3. Collection ID: type `users` → click **Next**
4. Document ID: paste the **User UID** you copied above
5. Add these fields one by one (click **"Add field"** for each):

| Field name | Type   | Value |
|-----------|--------|-------|
| uid       | string | (paste the UID again) |
| email     | string | latha.s@kamalaniketan.com |
| name      | string | Latha S |
| role      | string | admin |

6. Click **Save**

✅ The admin account is ready.

---

## PART 2 — Get Gemini AI Key (for report card narratives)
*Time needed: ~5 minutes*

1. Go to: **https://aistudio.google.com**
2. Sign in with the same Google account
3. Click **"Get API key"** in the top left
4. Click **"Create API key"**
5. Select your Firebase project from the dropdown → click **Create API key in existing project**
6. Copy the API key (starts with `AIza...`)
7. Save it safely — you'll use it in Part 3

---

## PART 3 — Put the Code on GitHub
*Time needed: ~10 minutes*

### Step 3.1 — Create a GitHub account

1. Go to: **https://github.com**
2. Click **"Sign up"**
3. Follow the steps to create a free account
4. Verify your email

---

### Step 3.2 — Create a new repository

1. After logging in, click the **"+"** icon at top right → **"New repository"**
2. Repository name: `kamala-niketan`
3. Make sure **"Private"** is selected (keeps your code private)
4. Click **"Create repository"**

---

### Step 3.3 — Install Git on your computer

**On Windows:**
1. Go to: **https://git-scm.com/download/windows**
2. Download and install (click Next through all steps)

**On Mac:**
1. Open Terminal (search "Terminal" in Spotlight)
2. Type: `git --version` → it will prompt to install automatically

---

### Step 3.4 — Upload the code

1. Open **Terminal** (Mac) or **Command Prompt** (Windows — search "cmd")
2. Type these commands one by one, pressing Enter after each:

```bash
cd path/to/kamala-niketan
```
*(Replace `path/to/kamala-niketan` with the actual folder location, e.g. `cd Desktop/kamala-niketan`)*

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kamala-niketan.git
git push -u origin main
```
*(Replace `YOUR_USERNAME` with your GitHub username)*

3. When asked for username/password, use your GitHub credentials

✅ Code is now on GitHub.

---

## PART 4 — Deploy to Vercel (Make it Live)
*Time needed: ~10 minutes*

### Step 4.1 — Create Vercel account

1. Go to: **https://vercel.com**
2. Click **"Sign Up"**
3. Click **"Continue with GitHub"** → authorize it

---

### Step 4.2 — Import your project

1. On the Vercel dashboard, click **"Add New Project"**
2. Find `kamala-niketan` in the list → click **Import**
3. Framework Preset: **Vite** (should auto-detect)
4. Click **"Environment Variables"** to expand it

---

### Step 4.3 — Add your secret keys

Add each of these one by one (click "Add" after each):

| Name | Value |
|------|-------|
| `VITE_FIREBASE_API_KEY` | Your Firebase apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | Your Firebase authDomain |
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase projectId |
| `VITE_FIREBASE_STORAGE_BUCKET` | Your Firebase storageBucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your Firebase messagingSenderId |
| `VITE_FIREBASE_APP_ID` | Your Firebase appId |
| `VITE_GEMINI_API_KEY` | Your Gemini API key |

*(These are the values you saved from Step 1.6 and Part 2)*

---

### Step 4.4 — Deploy

1. Click **"Deploy"**
2. Wait ~2 minutes
3. You'll see: **"Congratulations! Your deployment is live."**
4. Click **"Visit"** — your website is now live at `kamala-niketan.vercel.app`

✅ **The system is live!**

---

## PART 5 — First-Time Setup Inside the App
*Time needed: ~30 minutes*

### Step 5.1 — Log in as Admin

1. Open your website URL
2. Select **"Admin"** role
3. Email: `latha.s@kamalaniketan.com`
4. Password: the one you set in Step 1.7

---

### Step 5.2 — Set up Curriculum

1. Click **"Curriculum"** in the left sidebar
2. For each grade (PreKG, LKG, UKG):
   - Select the grade tab
   - Click **"+ Add Area"** → type the area name (e.g. "Physical Development")
   - Expand the area → click **"+ Add Sub-area"**
   - Inside each sub-area → click **"+ Add Skill"** for every skill

**Tip:** Use the PDF checklist provided to copy the exact skill names.

---

### Step 5.3 — Add Teacher accounts

1. Click **"Teachers"** in the sidebar
2. Click **"+ Add Teacher"** for each teacher
3. Fill: Name, Email, Password, and assign their Class (PP1–PP10)
4. Repeat for all 20 teachers

**Give each teacher:**
- Their email
- Their password
- The website URL: `https://kamala-niketan.vercel.app`

---

### Step 5.4 — Add Students

**Option A — Excel import (fastest for bulk):**
1. Create an Excel file with columns: `Name`, `DOB`, `Grade`, `Class`
2. Fill in all student data
3. Go to **"Students"** → click **"📥 Import Excel"**
4. Select your file → all students are added instantly

**Option B — Manual:**
1. Go to **"Students"** → click **"+ Add Student"**
2. Fill in name, DOB, grade, class → Save
3. Repeat for each student

---

## PART 6 — Ongoing Maintenance

### Adding a new teacher
→ Go to Teachers → Add Teacher → fill form

### Adding a new student mid-year
→ Go to Students → Add Student → fill form

### Teacher forgot password
→ Go to Teachers → find teacher → click "Reset Pwd"
→ They'll receive a password reset email

### Updating the app after code changes
→ Just push to GitHub:
```bash
git add .
git commit -m "Update description"
git push
```
→ Vercel automatically redeploys within 2 minutes. No other action needed.

### Backing up data
→ Firebase stores data automatically with redundancy.
→ For an extra backup: Firebase Console → Firestore → Export (monthly recommended)

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|---------|
| "Permission denied" error | Check Firestore rules are published correctly (Step 1.5) |
| Teacher can't log in | Check their email/password in Firebase Authentication |
| Page won't load | Check all 7 environment variables are set in Vercel |
| AI narrative fails | Check VITE_GEMINI_API_KEY is correct in Vercel |
| Build fails on Vercel | Check the build log → contact support with screenshot |

---

## QUICK REFERENCE

| URL | Purpose |
|-----|---------|
| `https://kamala-niketan.vercel.app` | The live app |
| `https://console.firebase.google.com` | Manage database & users |
| `https://vercel.com/dashboard` | Manage deployment |
| `https://aistudio.google.com` | Manage AI API key |

---

*Guide prepared for Kamala Niketan | Keep this document confidential*
