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

# Install npm dependencies
if [ ! -d "node_modules" ]; then
    echo "[] Installing JavaScript dependencies..."
    npm install
fi

# Check for Python
if ! command -v python3 &> /dev/null
then
    echo "[!] Python3 could not be found."
    echo "Please install Python 3.x using your system package manager."
    exit 1
else
    echo "[OK] Python is installed."
fi

# Install python packages
if ! python3 -c "import pdfplumber" &> /dev/null; then
    echo "[] Installing Python dependencies..."
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    ./venv/bin/pip install pdfplumber
fi

echo "==================================================="
echo "[!] STARTING OMNI SWIM APP..."
echo "[!] A browser tab will open automatically."
echo "[!] KEEP THIS TERMINAL OPEN."
echo "==================================================="

(sleep 4 && python3 -c "import webbrowser; webbrowser.open('http://localhost:3000')") &
npm run dev
