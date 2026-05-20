# Setup Panel Quick Start

## Adding Your First Appwrite Project

### Open the Setup Panel

Press **`Ctrl+Shift+P`** (or **`Cmd+Shift+P`** on Mac) and type:

```
AppForge: Add Project
```

A professional setup panel opens on your screen.

---

## The Setup Panel UI

```
┌─────────────────────────────────────────┐
│ 🎯 Add Project                          │
├─────────────────────────────────────────┤
│                                         │
│ ℹ️ Keep This Open                       │
│ You can safely switch to your Appwrite  │
│ console to copy credentials.            │
│                                         │
│ Project Name *                          │
│ [My Awesome App.....................]  │
│  Display name for your project          │
│                                         │
│ Endpoint *                              │
│ [https://appwrite.example.com/v1.....]  │
│  Your Appwrite server endpoint URL      │
│                                         │
│ Project ID *                            │
│ [670a5f2f84c92........................]  │
│  Found in your Appwrite console         │
│                                         │
│ API Key *                               │
│ [••••••••••••••••••••••••••••••••••.]  │
│  API key with database and functions    │
│                                         │
│  [Test Connection]  [Save Project]      │
│  [Open Appwrite Console]                │
│                                         │
└─────────────────────────────────────────┘
```

---

## Step-by-Step Guide

### 1️⃣ Fill In Your Project Name

Type the name you want to use for this project in VS Code:

```
Project Name: My App
```

**Requirements**:

- Required (can't be empty)
- Max 100 characters

### 2️⃣ Get Your Endpoint

Your Appwrite endpoint URL is where your Appwrite server is hosted.

**Click "Open Appwrite Console"** → Navigate to Settings → Copy your endpoint

Format: `https://your-server.com/v1`

```
Endpoint: https://cloud.appwrite.io/v1
```

**Requirements**:

- Must be a valid URL
- Must use HTTPS (secure)
- Must end with `/v1`

### 3️⃣ Get Your Project ID

From the Appwrite console:

- Go to **Settings** → **API Credentials**
- Copy your **Project ID**

```
Project ID: 670a5f2f84c92
```

**Requirements**:

- Required (can't be empty)
- Found in Appwrite Console

### 4️⃣ Create an API Key

In the Appwrite console:

1. Go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Give it a name (e.g., "VS Code AppForge")
4. Select scopes:
   - ✅ `databases.read` (to access databases)
   - ✅ `functions.read` (to access functions)
5. Copy the key

```
API Key: a7f82bd9e8c4...
```

**Requirements**:

- Required (can't be empty)
- Keep it secret (like a password)
- Stored securely in VS Code

---

## The Buttons

### 🌐 Open Appwrite Console

Opens your Appwrite account in the browser so you can:

- View your Project ID
- Generate API Keys
- Manage settings
- Verify your endpoint

### 🧪 Test Connection

Before saving, test that everything works:

1. Fills in the endpoint, project ID, and API key
2. Attempts to connect to Appwrite
3. Shows "✓ Connection successful!" or error details
4. **Safe to test multiple times** (doesn't create anything)

### 💾 Save Project

Saves your project permanently:

- Validates all fields
- Tests connection one more time
- Stores project in VS Code
- Encrypts your API key
- Closes panel on success

---

## Key Features

### ✨ **Auto-Save**

As you type each field, it's automatically saved to your browser's local storage. If you close the panel and reopen it, all your values are right there.

```
Type "My App" → ✓ Saved
Switch to browser → ✓ Values preserved
Return to VS Code → ✓ "My App" still there
```

### 🔒 **Your Data is Safe**

- API Keys are encrypted by VS Code
- Never sent to anyone except your Appwrite server
- Stored locally only
- Deleted if you remove the project

### 🌐 **Safe Browser Switching**

This is the key difference from the old input boxes:

- ❌ **Old way**: Input boxes close when you switch to browser
- ✅ **New way**: Panel stays open, preserves everything

### ✅ **Validation**

The panel validates as you go:

- Required fields have a red `*`
- Invalid URLs show error
- Error messages appear inline
- Submit button disabled until form is valid

---

## Example Workflow

### Scenario: You're setting up AppForge for the first time

**Time: 2:00 PM**

1. Open Command Palette: `Ctrl+Shift+P`
2. Type: `AppForge: Add Project`
3. Setup panel opens
4. Type: "My Cloud App"
5. Panel auto-saves (✓)

**Time: 2:01 PM**

6. Click "Open Appwrite Console"
7. Browser opens, you're in Appwrite
8. Navigate to Settings
9. Copy endpoint: `https://cloud.appwrite.io/v1`
10. Switch back to VS Code

**Time: 2:02 PM**

11. Paste endpoint in panel
12. Panel auto-saves (✓)
13. Navigate to API Credentials
14. Copy Project ID: `670a5f2f84c92`
15. Switch back to VS Code

**Time: 2:03 PM**

16. Paste Project ID in panel
17. Panel auto-saves (✓)
18. Still in Appwrite, go to API Keys
19. Create new key "VS Code AppForge"
20. Select scopes: databases.read, functions.read
21. Copy key

**Time: 2:04 PM**

22. Switch back to VS Code
23. Paste API Key in panel
24. Panel auto-saves (✓)
25. Click "Test Connection"
26. Shows "✓ Connection successful!"
27. Click "Save Project"
28. Shows "✓ Project saved successfully!"
29. Panel closes
30. Tree view updates with your project

**Total time: ~4 minutes, zero frustration!**

---

## Troubleshooting

### ❌ "Connection failed: Invalid endpoint"

**Possible causes**:

- Wrong URL format (missing https://)
- Endpoint is offline
- Typo in endpoint

**Solution**:

- Go back to Appwrite Console
- Copy endpoint again
- Make sure it starts with `https://`
- Try "Test Connection" again

### ❌ "Connection failed: Unauthorized"

**Possible causes**:

- API key doesn't have the right scopes
- API key is for a different project
- API key was revoked

**Solution**:

- Check project ID matches
- Create new API key with correct scopes
- Make sure key hasn't expired

### ❌ "Invalid URL format"

**What it means**:

- Your endpoint doesn't look like a valid URL

**Example of valid**:

- ✅ `https://cloud.appwrite.io/v1`
- ✅ `https://my-server.com/v1`

**Example of invalid**:

- ❌ `appwrite.io/v1` (missing https://)
- ❌ `http://...` (must use HTTPS)
- ❌ `https://my-server.com` (missing /v1)

---

## Questions?

In the setup panel, you can:

- **Click "Open Appwrite Console"** to access your Appwrite account
- **Check Appwrite docs** at appwrite.io/docs
- **Join Appwrite Discord** at discord.gg/appwrite

---

## What's Next?

Once your project is added:

- 📦 Browse your **Databases** in the tree view
- ⚙️ Execute your **Functions**
- 📋 View **Logs** from function executions
- ✨ Use **Snippets** in your code

**Happy building!** 🚀
