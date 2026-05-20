# Quick Start: AppForge Setup Guide

## Adding Your First Appwrite Project

### Step 1: Open the Setup Guide

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type: `AppForge: Show Setup Guide`
3. Press Enter

A guide panel opens on the right side with step-by-step instructions.

### Step 2: Keep Guide Open While You Work

The Setup Guide stays open - you can:

- 🔗 Click "Open Appwrite Console" to go to your Appwrite account
- 📖 Read documentation links
- 💡 Follow the helpful tips
- **The guide won't close when you switch to your browser!**

### Step 3: Gather Your Information

From your Appwrite Console, you need:

1. **Project Name** (any name you want)
   - Example: `My Awesome App`

2. **Endpoint URL**
   - Looks like: `https://appwrite.example.com/v1`
   - Found in: Console → Settings

3. **Project ID**
   - Looks like: `670a5f2f84c92`
   - Found in: Console → Settings

4. **API Key**
   - Follow the "Create an API Key" step in the guide
   - Scopes needed: `databases.read` and `functions.read`
   - Keep it secret! (It's encrypted locally)

### Step 4: Create the Project in VS Code

When you have all the info ready:

1. Keep the Setup Guide open
2. Press `Ctrl+Shift+P` again
3. Type: `AppForge: Add Project`
4. Fill in each field when prompted:
   - Project Name → Enter → Next
   - Endpoint → Enter → Next
   - Project ID → Enter → Next
   - API Key → Enter → Done

✅ Your project is now added!

### Step 5: Start Using AppForge

In the AppForge sidebar (left panel):

- 📦 **Databases** - View and manage databases
- ⚙️ **Functions** - Execute and deploy functions
- 📋 **Logs** - View execution logs

---

## Why Keep the Guide Open?

**Before**: Guide closes when you switch to browser

```
❌ User starts setup
❌ Needs to open browser for endpoint
❌ Dialog closes
❌ Has to start over
```

**Now**: Guide stays open while you work

```
✅ Guide stays open on the side
✅ User can click links to Appwrite Console
✅ User collects all info
✅ Returns to VS Code with everything ready
✅ Quick setup - no starting over!
```

---

## Tip: Save Your Endpoint

Once you've used AppForge with a project, it remembers the endpoint. When you add another project from the same server, you can reuse it!

---

## Need Help?

In the Setup Guide panel, click:

- 📖 **API Keys Documentation** - Learn about API Keys
- 🔗 **Appwrite Discord** - Ask the community
- 📚 **Appwrite Docs** - Complete documentation

---

## What Happens to Your API Key?

Your API Key is:

- ✅ **Encrypted** - Stored securely by VS Code
- ✅ **Local** - Never sent to anyone
- ✅ **Protected** - Removed if you delete the project
- ✅ **Safe** - Follows VS Code security best practices

---

**Happy building with AppForge!** 🚀
