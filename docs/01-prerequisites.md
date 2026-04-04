# 01 — Prerequisites & Environment Setup

This section walks you through installing every tool needed for this project. We'll verify each one after installation.

> **Your system:** Windows 11 with at least 8GB RAM and 20GB free disk space.

---

## 1.1 Git

**What it is:** Git is a version control system — it tracks every change you make to your code, lets you undo mistakes, and enables collaboration through branches and merging.

**Install:**
- Download from https://git-scm.com/downloads/win
- Run the installer with default options
- During setup, choose "Git from the command line and also from 3rd-party software"

**Verify:**
```bash
git --version
# Expected: git version 2.x.x
```

**Configure your identity** (Git attaches this to every commit you make):
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

**Verify config:**
```bash
git config --global --list
```

> **Resource:** [Git Documentation](https://git-scm.com/doc) | [Git Handbook (GitHub)](https://docs.github.com/en/get-started/using-git/about-git)

---

## 1.2 Node.js & npm

**What it is:** Node.js is a JavaScript runtime that lets you run JavaScript outside the browser. npm (Node Package Manager) comes bundled with it and is used to install JavaScript libraries.

**Install:**
- Download the LTS version from https://nodejs.org/
- Run the installer with default options
- Check "Automatically install the necessary tools" if prompted

**Verify:**
```bash
node --version
# Expected: v22.x.x or higher

npm --version
# Expected: 10.x.x or higher
```

> **Resource:** [Node.js Documentation](https://nodejs.org/en/docs)

---

## 1.3 Python & pip

**What it is:** Python is the programming language we use for the backend API. pip is Python's package manager (like npm for JavaScript).

**Install:**
- Download from https://www.python.org/downloads/
- **Important:** Check "Add Python to PATH" during installation
- Run the installer

**Verify:**
```bash
python --version
# Expected: Python 3.12.x or higher

pip --version
# Expected: pip 24.x.x
```

> **Resource:** [Python Documentation](https://docs.python.org/3/)

---

## 1.4 Docker Desktop

**What it is:** Docker packages applications into **containers** — lightweight, portable units that include everything an app needs to run (code, runtime, libraries, settings). This solves the "works on my machine" problem. Docker Desktop is the Windows application that lets you build and run containers.

**Install:**

1. **Enable WSL2 first** (Windows Subsystem for Linux — Docker uses this as its backend on Windows):
   ```powershell
   # Run in PowerShell as Administrator
   wsl --install
   ```
   Restart your computer after this completes.

2. **Download Docker Desktop** from https://www.docker.com/products/docker-desktop/

3. Run the installer:
   - Check "Use WSL 2 instead of Hyper-V" (recommended)
   - Complete the installation and restart if prompted

4. **Start Docker Desktop** from the Start menu. Wait for the whale icon in the system tray to show "Docker Desktop is running."

**Verify:**
```bash
docker --version
# Expected: Docker version 27.x.x

docker run hello-world
# Expected: "Hello from Docker!" message — confirms Docker can pull and run images
```

> **Resource:** [Docker Get Started Guide](https://docs.docker.com/get-started/) | [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)

---

## 1.5 kubectl

**What it is:** `kubectl` (pronounced "kube-control" or "kube-cuddle") is the command-line tool for interacting with Kubernetes clusters. You use it to deploy apps, inspect resources, and view logs.

**Install** (choose one method):

**Option A — Via curl:**
```bash
curl -LO "https://dl.k8s.io/release/v1.31.0/bin/windows/amd64/kubectl.exe"
```
Move `kubectl.exe` to a directory in your PATH (e.g., `C:\Program Files\kubectl\`), then add that directory to your system PATH.

**Option B — Via winget:**
```powershell
winget install Kubernetes.kubectl
```

**Option C — Via Docker Desktop:**
Docker Desktop can install kubectl for you. Go to Settings → Kubernetes → check "Enable Kubernetes." However, we'll use Minikube instead, so just ensure kubectl is available.

**Verify:**
```bash
kubectl version --client
# Expected: Client Version: v1.31.x
```

> **Resource:** [Install kubectl on Windows](https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/)

---

## 1.6 Minikube

**What it is:** Minikube runs a single-node Kubernetes cluster on your local machine. It's the easiest way to learn Kubernetes without paying for cloud infrastructure. It creates a small virtual environment (using Docker) that behaves like a real Kubernetes cluster.

**Install:**

**Option A — Via winget (recommended):**
```powershell
winget install Kubernetes.minikube
```

**Option B — Direct download:**
- Download from https://minikube.sigs.k8s.io/docs/start/
- Choose Windows → x86-64 → .exe download
- Move to a directory in your PATH

**Verify:**
```bash
minikube version
# Expected: minikube version: v1.34.x
```

**Quick test** (optional — we'll do this properly later):
```bash
minikube start --driver=docker
minikube status
# Expected: host: Running, kubelet: Running, apiserver: Running
minikube stop
```

> **Resource:** [Minikube Documentation](https://minikube.sigs.k8s.io/docs/)

---

## 1.7 GitHub Account

**What it is:** GitHub is a platform that hosts Git repositories online. We use it for storing our code remotely and running CI/CD pipelines via GitHub Actions.

1. Create a free account at https://github.com/ (if you don't have one)
2. Install the GitHub CLI for easier interaction:

```powershell
winget install GitHub.cli
```

**Verify:**
```bash
gh --version
# Expected: gh version 2.x.x

gh auth login
# Follow the prompts to authenticate
```

> **Resource:** [GitHub CLI Documentation](https://cli.github.com/manual/)

---

## 1.8 Optional but Recommended Tools

### MongoDB Compass (Database GUI)
A graphical tool for viewing and editing your MongoDB data. Very helpful for debugging.
- Download: https://www.mongodb.com/products/tools/compass
- Install with default options

### VS Code (Code Editor)
If you're not already using it:
- Download: https://code.visualstudio.com/
- Recommended extensions: Python, ESLint, Prettier, Docker, Kubernetes, Tailwind CSS IntelliSense

### Postman or Thunder Client (API Testing)
For manually testing API endpoints. Alternatively, we'll use FastAPI's built-in Swagger UI.
- Postman: https://www.postman.com/downloads/
- Thunder Client: VS Code extension (search "Thunder Client" in Extensions)

---

## 1.9 Verification Checklist

Run this to confirm everything is installed:

```bash
echo "=== Git ===" && git --version
echo "=== Node.js ===" && node --version
echo "=== npm ===" && npm --version
echo "=== Python ===" && python --version
echo "=== pip ===" && pip --version
echo "=== Docker ===" && docker --version
echo "=== kubectl ===" && kubectl version --client
echo "=== Minikube ===" && minikube version
echo "=== GitHub CLI ===" && gh --version
```

All commands should return version numbers without errors. If any fail, revisit that tool's installation steps above.

---

**Next:** [02-claude-code-setup.md](02-claude-code-setup.md) — Set up Claude Code for maximum productivity.
