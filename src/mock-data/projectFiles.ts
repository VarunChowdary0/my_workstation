import { FileNode } from "@/types/types";

export const MOCK_PROJECT_0: FileNode[] = [
  {
    name: "src",
    children: [
      {
        name: "index.js",
        content: `console.log('Hello from index.js');`,
        isEditable: false,
      },
      {
        name: "app.js",
        content: `function App() { console.log('App running'); }`,
        isEditable: true,
      },
      {
        name: "utils.js",
        content: `export const add = (a, b) => a + b;`,
        isEditable: true,
      },
    ],
  },
  {
    name: "package.json",
    content: `{
  "name": "demo-project",
  "version": "1.0.0" 
  }`,
    isEditable: false,
  },
];

export const MOCK_PROJECT_REACT: FileNode[] = [
  {
    name: "src",
    children: [
      {
        name: "components",
        children: [
          {
  name: "test-langs",
  children: [
    { name: "hello.html", content: `<html dir="ltr" lang="en" dark="" class="focus-outline-visible" style="background-color: rgb(39, 64, 60); background-image: unset; --ntp-theme-text-color: rgba(232, 234, 237, 1.00);"><head>
    <meta charset="utf-8">
    <title>New Tab</title>
    <style>
      html {
        --ntp-focus-shadow-color: rgba(var(--google-blue-600-rgb), .4);
        --ntp-theme-text-color: var(--google-grey-800);
        background-attachment: fixed;
        background-color: rgba(60,60,60,1);
        background-position: -64px;
        background-repeat: no-repeat;
        height: 100%;
        overflow: auto;
      }

      @media (prefers-color-scheme: dark) {
        html {
          --ntp-focus-shadow-color: rgba(var(--google-blue-300-rgb), .5);
          --ntp-theme-text-color: white;
        }
      }

      html[has-custom-background] {
        background-image: image-set(
            url(chrome://theme/IDR_THEME_NTP_BACKGROUND?user_color_theme_id) 1x,
            url(chrome://theme/IDR_THEME_NTP_BACKGROUND@2x?user_color_theme_id) 2x);
      }

      body {
        align-items: center;
        display: flex;
        height: 100vh;
        justify-content: center;
        margin: 0;
      }

      cr-most-visited {
        --most-visited-focus-shadow: 0 0 0 2px var(--ntp-focus-shadow-color);
        --most-visited-text-color: var(--ntp-theme-text-color);
        --most-visited-text-shadow: none;
      }

      html[has-custom-background] cr-most-visited {
        --most-visited-text-shadow: 0 0 16px rgba(0, 0, 0, .3);
      }
    </style>
  </head>
  <body>
    <script type="module" src="strings.m.js"></script>
    <cr-most-visited visible_="" use-white-tile-icon_="" is-dark_=""></cr-most-visited>
    <script type="module" src="new_tab_page_third_party.js"></script>
    <link rel="stylesheet" href="chrome://resources/css/text_defaults_md.css">
  

</body></html>`, isEditable: true },
    { name: "hello.css", content: ` 
html {
  --ntp-focus-shadow-color: rgba(var(--google-blue-600-rgb), .4);
  --ntp-theme-text-color: var(--google-grey-800);
  background-attachment: fixed;
  background-color: rgba(60,60,60,1);
  background-position: -64px;
  background-repeat: no-repeat;
  height: 100%;
  overflow: auto;
}

@media (prefers-color-scheme: dark) {
  html {
    --ntp-focus-shadow-color: rgba(var(--google-blue-300-rgb), .5);
    --ntp-theme-text-color: white;
  }
}

html[has-custom-background] {
  background-image: image-set(
      url(chrome://theme/IDR_THEME_NTP_BACKGROUND?user_color_theme_id) 1x,
      url(chrome://theme/IDR_THEME_NTP_BACKGROUND@2x?user_color_theme_id) 2x);
}

body {
  align-items: center;
  display: flex;
  height: 100vh;
  justify-content: center;
  margin: 0;
}
`, isEditable: true },
    { name: "hello.js", content: `console.log('Hello from JavaScript');`, isEditable: true },
    { name: "hello.ts", content: `console.log('Hello from TypeScript');`, isEditable: true },
    { name: "hello.py", content: `print("Hello from Python")`, isEditable: true },
    { name: "hello.java", content: `public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello from Java");
    }
}`, isEditable: true },
    { name: "hello.cpp", content: `#include <iostream>
using namespace std;
int main() {
    cout << "Hello from C++" << endl;
    return 0;
}`, isEditable: true },
    { name: "hello.c", content: `#include <stdio.h>
int main() {
    printf("Hello from C\\n");
    return 0;
}`, isEditable: true },
    { name: "hello.cs", content: `
}`, isEditable: true },
    { name: "hello.rb", content: `puts "Hello from Ruby"`, isEditable: true },
    { name: "hello.go", content: `package main
import "fmt"
func main() {
    fmt.Println("Hello from Go")
}`, isEditable: true },
    { name: "hello.rs", content: `fn main() {
    println!("Hello from Rust");
}`, isEditable: true },
    { name: "hello.swift", content: `print("Hello from Swift")`, isEditable: true },
    { name: "hello.kt", content: `fun main() {
    println("Hello from Kotlin")
}`, isEditable: true },
    { name: "hello.scala", content: `object Hello extends App {
    println("Hello from Scala")
}`, isEditable: true },
    { name: "hello.php", content: `<?php
echo "Hello from PHP\n";
?>`, isEditable: true },
    { name: "hello.perl", content: `print "Hello from Perl\n";`, isEditable: true },
    { name: "hello.hs", content: `main = putStrLn "Hello from Haskell"`, isEditable: true },
    { name: "hello.elixir", content: `IO.puts "Hello from Elixir"`, isEditable: true },
    { name: "hello.lua", content: `print("Hello from Lua")`, isEditable: true },
    { name: "hello.d", content: `import std.stdio;
void main() {
    writeln("Hello from D");
}`, isEditable: true },
    { name: "hello.f90", content: `program hello
    print *, "Hello from Fortran"
end program hello`, isEditable: true },
    { name: "hello.m", content: `disp('Hello from MATLAB');`, isEditable: true }
  ]
}
          ,
          {
            name: "Header.tsx",
            content: `import React from 'react';

export const Header = () => {
  return <header><h1>My App</h1></header>;
};`,
            isEditable: true,
          },
          {
            name: "Footer.tsx",
            content: `import React from 'react';

export const Footer = () => {
  return <footer>Footer Content</footer>;
};`,
            isEditable: true,
          },
        ],
      },
      {
        name: "pages",
        children: [
          {
            name: "index.tsx",
            content: `import React from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <main>Welcome to the demo React app!</main>
      <Footer />
    </>
  );
}`,
            isEditable: false,
          },
        ],
      },
      {
        name: "App.tsx",
        content: `import React from 'react';
import Home from './pages/index';

export default function App() {
  return <Home />;
}`,
        isEditable: false,
      },
      {
        name: "index.tsx",
        content: `import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

ReactDOM.render(<App />, document.getElementById('root'));`,
        isEditable: false,
      },
      {
        name: "utils.ts",
        content: `export const add = (a: number, b: number) => a + b;`,
        isEditable: true,
      },
    ],
  },
  {
    name: "package.json",
    content: `{
  "name": "demo-react-project",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}`,
    isEditable: false,
  },
  {
    name: "tsconfig.json",
    content: `{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "jsx": "react-jsx"
  }
}`,
    isEditable: false,
  },
];
