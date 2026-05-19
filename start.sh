#!/bin/bash
echo "==================================================="
echo "[ OMNI SWIM MATRIX INITIALIZATION ]"
echo "==================================================="

# Check for Node.js
if ! command -v node &> /dev/null
then
    echo "[!] Node.js could not be found."
    echo "Installing via NVM (Node Version Manager)..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
else
    echo "[OK] Node.js is installed."
fi

# Check for Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null
then
    echo "[!] Python could not be found."
    echo "Please install Python 3.x using your system package manager."
    exit 1
else
    echo "[OK] Python is installed."
fi

echo "[!] Scanning and installing dependencies..."
node scan_deps.mjs

echo "==================================================="
echo "[!] STARTING OMNI SWIM APP..."
echo "[!] A browser tab will open automatically."
echo "[!] KEEP THIS TERMINAL OPEN."
echo "==================================================="

(sleep 4 && python3 -c "import webbrowser; webbrowser.open('http://localhost:3000')" 2>/dev/null || python -c "import webbrowser; webbrowser.open('http://localhost:3000')" 2>/dev/null) &
npm run dev
