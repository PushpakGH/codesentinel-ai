# 🚀 How to Build Apps with CodeSentinel AI (Project Builder)

CodeSentinel AI isn't just a code reviewer—it's an **AI Software Engineer** that can build entire projects for you from scratch!

This guide will show you how to turn your idea into a working Next.js application in minutes.

---

## ✅ Prerequisites

1.  **VS Code** installed.
2.  **CodeSentinel AI** extension installed and enabled.
3.  **API Key Configured**:
    *   Open Command Palette (`Ctrl+Shift+P`).
    *   Run `CodeSentinel: Configure API Key`.
    *   Enter your Google Gemini API Key (or set up Ollama for offline use).

---

## 🏗️ Step-by-Step Guide

### Step 1: Open the Project Builder
Don't worry about creating folders manually. CodeSentinel handles everything.

1.  Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac) to open the Command Palette.
2.  Type **"Build Project"** and select:
    > **CodeSentinel: Build Project**

### Step 2: Describe Your Dream App
A text box will appear. Type what you want to build. Be as specific or as general as you like!

**Examples:**
*   *"A personal portfolio website with a dark theme, an 'About Me' section, and a contact form."*
*   *"A dashboard for a crypto trading app with live charts, a sidebar, and a user profile settings page."*
*   *"A simple To-Do list app that uses local storage."*

### Step 3: Choose Where to Save It
1.  A file dialog will open.
2.  Create a new empty folder (e.g., `my-awesome-app`) or select an existing one.
3.  Click **Select Folder**.

### Step 4: Review the Plan
CodeSentinel will analyze your request and generate a **Project Plan**. You will see:
*   📂 **File Structure**: The folders and files it will create.
*   📦 **Dependencies**: Libraries it will install (like Shadcn UI, Lucid Icons).
*   📄 **Pages**: A list of pages (Home, Dashboard, etc.).

> **Action:** If the plan looks good, click **"Yes, Build It!"** in the notification/dialog.

### Step 5: Watch the Magic Happen 🪄
The AI will now start working. You can watch the `Output` panel to see real-time progress:
1.  **Scaffolding**: Sets up the Next.js framework.
2.  **Installing**: Downloads necessary packages (`npm install`).
3.  **Generating**: Writes the actual code for your pages and components.
    *   *Note: CodeSentinel ensures all imports are correct and fixes any errors automatically.*

### Step 6: Launch Your App!
Once finished, you will see a success message:
> "✅ Project 'My App' generated successfully!"

1.  Click **"Open Project"**.
2.  VS Code will open your new project folder.
3.  Open a terminal (`Ctrl+\``) and run:
    ```bash
    npm run dev
    ```
4.  Open `http://localhost:3000` in your browser.

**🎉 Congratulations! You just built an app with AI.**

---

## 🧠 Tips for Best Results

*   **Mention "Dark Mode":** If you want a modern look, ask for "dark mode support".
*   **Ask for specific libraries:** e.g., *"Use 'Recharts' for the graphs"* or *"Use 'Framer Motion' for animations"*.
*   **Don't worry about errors:** CodeSentinel has a built-in "Self-Correction" agent that fixes broken code before you even see it.

---

## ❓ Troubleshooting

*   **"Authentication Failed"**: Check your API Key (`CodeSentinel: Configure API Key`).
*   **"Rate Limit Exceeded"**: You might be generating too fast. Wait a minute and try again.
*   **Build Errors**: Run `npm install` manually if dependencies seem missing.
