# Framework Setup Guide for Workstation

This guide explains the required structure and configuration for each supported framework to work properly with the Workstation code execution environment.

---

## Table of Contents
- [Node.js / Express](#nodejs--express)
- [Next.js](#nextjs)
- [React (Create React App)](#react-create-react-app)
- [Vite (React/Vue/Svelte)](#vite-reactvuesvelte)
- [Python (FastAPI)](#python-fastapi)
- [Python (Flask)](#python-flask)
- [Simple Web (HTML/CSS/JS)](#simple-web-htmlcssjs)

---

## Node.js / Express

### Required Files
```
project/
├── package.json
├── server.js (or app.js, index.js, main.js)
└── ... other files
```

### package.json
```json
{
  "name": "my-express-app",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

### server.js (Entry Point)
```javascript
const express = require('express');
const app = express();

// IMPORTANT: Use process.env.PORT for dynamic port assignment
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/api/data', (req, res) => {
  res.json({ message: 'API response', status: 'ok' });
});

// IMPORTANT: Use PORT variable in listen()
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
```

### Key Points
- Always use `process.env.PORT || <default>` for the port
- Entry file should be named: `server.js`, `app.js`, `index.js`, or `main.js`
- Hot reload is enabled via `nodemon` automatically

---

## Next.js

### Required Files
```
project/
├── package.json
├── next.config.js (optional)
├── pages/
│   ├── index.js
│   └── api/
│       └── hello.js
└── ... other files
```

### package.json
```json
{
  "name": "my-nextjs-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

### pages/index.js
```jsx
export default function Home() {
  return (
    <div>
      <h1>Welcome to Next.js!</h1>
    </div>
  );
}
```

### pages/api/hello.js (API Route)
```javascript
export default function handler(req, res) {
  res.status(200).json({ message: 'Hello from API!' });
}
```

### Key Points
- Must have `next` in dependencies
- Port is automatically assigned via `--port` flag
- Hot reload is built-in (Fast Refresh)
- API routes go in `pages/api/` directory

---

## React (Create React App)

### Required Files
```
project/
├── package.json
├── public/
│   └── index.html
└── src/
    ├── index.js
    └── App.js
```

### package.json
```json
{
  "name": "my-react-app",
  "version": "1.0.0",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  },
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-scripts": "5.0.1"
  }
}
```

### src/index.js
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### src/App.js
```jsx
function App() {
  return (
    <div className="App">
      <h1>Hello React!</h1>
    </div>
  );
}

export default App;
```

### public/index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>React App</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

### Key Points
- Must have `react-scripts` in dependencies
- Port is set via `PORT` environment variable
- Hot reload is built-in

---

## Vite (React/Vue/Svelte)

### Required Files
```
project/
├── package.json
├── vite.config.js (optional)
├── index.html
└── src/
    ├── main.jsx
    └── App.jsx
```

### package.json
```json
{
  "name": "my-vite-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^5.0.0"
  }
}
```

### vite.config.js
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // Port will be overridden by --port flag
  }
});
```

### index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vite App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

### src/main.jsx
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### src/App.jsx
```jsx
function App() {
  return (
    <div>
      <h1>Hello Vite!</h1>
    </div>
  );
}

export default App;
```

### Key Points
- Must have `vite` in dependencies or devDependencies
- Port is set via `--port` flag
- Hot Module Replacement (HMR) is built-in

---

## Python (FastAPI)

### Required Files
```
project/
├── requirements.txt
└── main.py
```

### requirements.txt
```
fastapi>=0.100.0
uvicorn>=0.23.0
```

### main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI!"}

@app.get("/api/data")
async def get_data():
    return {
        "status": "ok",
        "data": [
            {"id": 1, "name": "Item 1"},
            {"id": 2, "name": "Item 2"},
        ]
    }

@app.post("/api/items")
async def create_item(item: dict):
    return {"status": "created", "item": item}
```

### Key Points
- Must have `fastapi` or `uvicorn` in requirements.txt
- Entry file should be named `main.py` with an `app` object
- Runs with: `uvicorn main:app --reload --host 0.0.0.0 --port <port>`
- Hot reload is enabled via `--reload` flag

---

## Python (Flask)

### Required Files
```
project/
├── requirements.txt
└── app.py (or main.py)
```

### requirements.txt
```
Flask>=3.0.0
```

### app.py
```python
from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route('/')
def home():
    return 'Hello from Flask!'

@app.route('/api/data')
def get_data():
    return jsonify({
        'status': 'ok',
        'data': [
            {'id': 1, 'name': 'Item 1'},
            {'id': 2, 'name': 'Item 2'},
        ]
    })

@app.route('/api/items', methods=['POST'])
def create_item():
    item = request.get_json()
    return jsonify({'status': 'created', 'item': item})

# Optional: For running directly with python app.py
if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
```

### Key Points
- Must have `flask` in requirements.txt
- Entry file should be named `app.py` or `main.py`
- Runs with: `flask run --host=0.0.0.0 --port=<port>`
- Debug mode is enabled via `FLASK_DEBUG=1`

---

## Simple Web (HTML/CSS/JS)

### Required Files
```
project/
├── index.html
├── style.css (optional)
└── script.js (optional)
```

### index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Web App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello World!</h1>
  <p id="output"></p>

  <script src="script.js"></script>
</body>
</html>
```

### style.css
```css
body {
  font-family: Arial, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  color: #333;
}
```

### script.js
```javascript
document.addEventListener('DOMContentLoaded', function() {
  const output = document.getElementById('output');
  output.textContent = 'JavaScript is working!';
});
```

### Key Points
- Must have `index.html` file
- No server required - uses browser preview directly
- CSS and JS files are linked from HTML
- Changes reflect immediately in preview

---

## Detection Priority

The workstation detects project type in this order:

1. **package.json with `next`** → Next.js
2. **package.json with `react-scripts`** → React CRA
3. **package.json with `vite`** → Vite
4. **package.json (other)** → Node.js
5. **requirements.txt with `fastapi`/`uvicorn`** → FastAPI
6. **requirements.txt with `flask`** → Flask
7. **requirements.txt or .py files** → Python
8. **index.html** → Simple Web
9. **None of above** → Unknown (cannot run)

---

## Environment Variables

All frameworks receive the `PORT` environment variable. Use it like this:

| Framework | How to Use PORT |
|-----------|-----------------|
| Node.js | `process.env.PORT \|\| 3000` |
| Next.js | Automatic (uses `--port` flag) |
| React CRA | Automatic (uses `PORT` env var) |
| Vite | Automatic (uses `--port` flag) |
| FastAPI | Automatic (uses `--port` flag) |
| Flask | Automatic (uses `--port` flag) |
| Python | `os.environ.get('PORT', 5000)` |

---

## Hot Reload Support

| Framework | Hot Reload Method | Notes |
|-----------|-------------------|-------|
| Node.js | nodemon | Auto-restarts on file change |
| Next.js | Fast Refresh | Built-in, preserves state |
| React CRA | Webpack HMR | Built-in |
| Vite | Vite HMR | Built-in, very fast |
| FastAPI | uvicorn --reload | Watches for .py changes |
| Flask | FLASK_DEBUG=1 | Watches for .py changes |
| Simple Web | N/A | Manual refresh in preview |
