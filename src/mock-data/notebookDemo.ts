import { FileNode, Project } from "@/types/types";

// Notebook cell types matching .ipynb format
export interface NotebookCell {
  cell_type: "code" | "markdown" | "raw";
  source: string[];
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: NotebookOutput[];
}

export interface NotebookOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  name?: string; // for stream: "stdout" | "stderr"
  text?: string[]; // for stream output
  data?: Record<string, unknown>; // for execute_result/display_data
  execution_count?: number;
  ename?: string; // for error
  evalue?: string; // for error
  traceback?: string[]; // for error
}

export interface NotebookContent {
  cells: NotebookCell[];
  metadata: {
    kernelspec?: {
      display_name: string;
      language: string;
      name: string;
    };
    language_info?: {
      name: string;
      version: string;
    };
  };
  nbformat: number;
  nbformat_minor: number;
}

// Sample notebook content
const sampleNotebook: NotebookContent = {
  cells: [
    {
      cell_type: "markdown",
      source: [
        "# Data Analysis Demo\n",
        "\n",
        "This notebook demonstrates basic Python data analysis with pandas and matplotlib."
      ],
      metadata: {}
    },
    {
      cell_type: "code",
      source: [
        "import pandas as pd\n",
        "import numpy as np\n",
        "import matplotlib.pyplot as plt\n",
        "from io import StringIO"
      ],
      metadata: {},
      execution_count: 1,
      outputs: []
    },
    {
      cell_type: "markdown",
      source: [
        "## Loading Data from CSV\n",
        "\n",
        "Let's load sample data using pandas `read_csv()`. In a real project, you would read from a file like `pd.read_csv('data/sample.csv')`."
      ],
      metadata: {}
    },
    {
      cell_type: "code",
      source: [
        "# Load data from project's data folder\n",
        "df = pd.read_csv('data/sample.csv')\n",
        "df"
      ],
      metadata: {},
      execution_count: 2,
      outputs: [
        {
          output_type: "execute_result",
          execution_count: 2,
          data: {
            "text/html": [
              "<div>\n",
              "<table border=\"1\" class=\"dataframe\">\n",
              "  <thead>\n",
              "    <tr style=\"text-align: right;\">\n",
              "      <th></th>\n",
              "      <th>name</th>\n",
              "      <th>age</th>\n",
              "      <th>score</th>\n",
              "      <th>city</th>\n",
              "    </tr>\n",
              "  </thead>\n",
              "  <tbody>\n",
              "    <tr><th>0</th><td>Alice</td><td>25</td><td>92</td><td>NYC</td></tr>\n",
              "    <tr><th>1</th><td>Bob</td><td>30</td><td>71</td><td>LA</td></tr>\n",
              "    <tr><th>2</th><td>Charlie</td><td>35</td><td>88</td><td>Chicago</td></tr>\n",
              "    <tr><th>3</th><td>Diana</td><td>28</td><td>65</td><td>Houston</td></tr>\n",
              "    <tr><th>4</th><td>Eve</td><td>32</td><td>79</td><td>Phoenix</td></tr>\n",
              "  </tbody>\n",
              "</table>\n",
              "</div>"
            ],
            "text/plain": [
              "      name  age  score     city\n",
              "0    Alice   25     92      NYC\n",
              "1      Bob   30     71       LA\n",
              "2  Charlie   35     88  Chicago\n",
              "3    Diana   28     65  Houston\n",
              "4      Eve   32     79  Phoenix"
            ]
          }
        }
      ]
    },
    {
      cell_type: "code",
      source: [
        "# Basic statistics\n",
        "print(\"Dataset Statistics:\")\n",
        "print(f\"Mean Age: {df['age'].mean():.1f}\")\n",
        "print(f\"Mean Score: {df['score'].mean():.1f}\")\n",
        "print(f\"Max Score: {df['score'].max()}\")"
      ],
      metadata: {},
      execution_count: 3,
      outputs: [
        {
          output_type: "stream",
          name: "stdout",
          text: [
            "Dataset Statistics:\n",
            "Mean Age: 30.0\n",
            "Mean Score: 79.0\n",
            "Max Score: 92\n"
          ]
        }
      ]
    },
    {
      cell_type: "markdown",
      source: [
        "## Using Project Utility Functions\n",
        "\n",
        "We can import functions from other Python files in the project. Let's use `utils.py`:"
      ],
      metadata: {}
    },
    {
      cell_type: "code",
      source: [
        "# Import functions from the project's utils.py\n",
        "from utils import get_top_performers, calculate_stats, summarize_by_city\n",
        "\n",
        "# Get top 3 performers\n",
        "top_3 = get_top_performers(df, 'score', n=3)\n",
        "print(\"Top 3 Performers:\")\n",
        "top_3"
      ],
      metadata: {},
      execution_count: null,
      outputs: []
    },
    {
      cell_type: "code",
      source: [
        "# Get statistics for the score column using our utility function\n",
        "score_stats = calculate_stats(df, 'score')\n",
        "print(\"Score Statistics:\")\n",
        "for key, value in score_stats.items():\n",
        "    print(f\"  {key}: {value:.2f}\")"
      ],
      metadata: {},
      execution_count: null,
      outputs: []
    },
    {
      cell_type: "markdown",
      source: [
        "## Data Visualization\n",
        "\n",
        "Let's create a bar chart showing scores by name using matplotlib."
      ],
      metadata: {}
    },
    {
      cell_type: "code",
      source: [
        "# Create a bar chart of scores\n",
        "plt.figure(figsize=(10, 6))\n",
        "colors = ['#4285f4', '#ea4335', '#fbbc05', '#34a853', '#9c27b0']\n",
        "bars = plt.bar(df['name'], df['score'], color=colors, edgecolor='black', linewidth=1.2)\n",
        "\n",
        "# Add value labels on bars\n",
        "for bar, score in zip(bars, df['score']):\n",
        "    plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1, \n",
        "             str(score), ha='center', va='bottom', fontweight='bold')\n",
        "\n",
        "plt.xlabel('Name', fontsize=12)\n",
        "plt.ylabel('Score', fontsize=12)\n",
        "plt.title('Scores by Person', fontsize=14, fontweight='bold')\n",
        "plt.ylim(0, 100)\n",
        "plt.grid(axis='y', alpha=0.3)\n",
        "plt.tight_layout()\n",
        "plt.show()"
      ],
      metadata: {},
      execution_count: 4,
      outputs: [
        {
          output_type: "display_data",
          data: {
            "image/png": "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",
            "text/plain": "<Figure size 1000x600 with 1 Axes>"
          }
        }
      ]
    },
    {
      cell_type: "markdown",
      source: [
        "## Error Handling Example\n",
        "\n",
        "Here's what an error looks like:"
      ],
      metadata: {}
    },
    {
      cell_type: "code",
      source: [
        "# This will cause an error\n",
        "result = 1 / 0"
      ],
      metadata: {},
      execution_count: 5,
      outputs: [
        {
          output_type: "error",
          ename: "ZeroDivisionError",
          evalue: "division by zero",
          traceback: [
            "\u001b[0;31m---------------------------------------------------------------------------\u001b[0m",
            "\u001b[0;31mZeroDivisionError\u001b[0m                         Traceback (most recent call last)",
            "Cell \u001b[0;32mIn[4], line 2\u001b[0m\n\u001b[1;32m      1\u001b[0m \u001b[38;5;66;03m# This will cause an error\u001b[39;00m\n\u001b[0;32m----> 2\u001b[0m result \u001b[38;5;241m=\u001b[39m \u001b[38;5;241;43m1\u001b[39;49m\u001b[43m \u001b[49m\u001b[38;5;241;43m/\u001b[39;49m\u001b[43m \u001b[49m\u001b[38;5;241;43m0\u001b[39;49m\n",
            "\u001b[0;31mZeroDivisionError\u001b[0m: division by zero"
          ]
        }
      ]
    },
    {
      cell_type: "code",
      source: [
        "# Unexecuted cell\n",
        "print(\"This cell hasn't been run yet\")"
      ],
      metadata: {},
      execution_count: null,
      outputs: []
    }
  ],
  metadata: {
    kernelspec: {
      display_name: "Python 3",
      language: "python",
      name: "python3"
    },
    language_info: {
      name: "python",
      version: "3.11.0"
    }
  },
  nbformat: 4,
  nbformat_minor: 5
};

// Project files for notebook_demo
export const NOTEBOOK_DEMO_FILES: FileNode[] = [
  {
    name: "README.md",
    content: `# Jupyter Notebook Demo

This project demonstrates Jupyter notebook support in the Workstation IDE.

## Features

- Render notebook cells (code & markdown)
- Display cell outputs (text, HTML tables, errors)
- Execute cells with Python kernel
- Edit cell content inline

## Files

- \`analysis.ipynb\` - Main data analysis notebook
- \`requirements.txt\` - Python dependencies
- \`data/\` - Sample data files
`,
    isEditable: true
  },
  {
    name: "analysis.ipynb",
    content: JSON.stringify(sampleNotebook, null, 2),
    isEditable: true
  },
  {
    name: "requirements.txt",
    content: `pandas>=2.0.0
numpy>=1.24.0
matplotlib>=3.7.0
jupyter>=1.0.0
ipykernel>=6.0.0
`,
    isEditable: true
  },
  {
    name: "data",
    children: [
      {
        name: "sample.csv",
        content: `name,age,score,city
Alice,25,92,NYC
Bob,30,71,LA
Charlie,35,88,Chicago
Diana,28,65,Houston
Eve,32,79,Phoenix
`,
        isEditable: true
      }
    ]
  },
  {
    name: "utils.py",
    content: `"""Utility functions for data analysis."""

import pandas as pd

def load_data(filepath: str) -> pd.DataFrame:
    """Load CSV data into a DataFrame."""
    return pd.read_csv(filepath)

def calculate_stats(df: pd.DataFrame, column: str) -> dict:
    """Calculate basic statistics for a column."""
    return {
        'mean': df[column].mean(),
        'std': df[column].std(),
        'min': df[column].min(),
        'max': df[column].max()
    }

def get_top_performers(df: pd.DataFrame, score_col: str = 'score', n: int = 3) -> pd.DataFrame:
    """Get the top N performers sorted by score."""
    return df.nlargest(n, score_col)

def summarize_by_city(df: pd.DataFrame) -> pd.DataFrame:
    """Summarize data by city with count, avg age, and avg score."""
    return df.groupby('city').agg({
        'name': 'count',
        'age': 'mean',
        'score': 'mean'
    }).rename(columns={'name': 'count'}).round(1)
`,
    isEditable: true
  }
];

// Full project object
export const NOTEBOOK_DEMO_PROJECT: Project = {
  id: "notebook_demo",
  files: NOTEBOOK_DEMO_FILES,
  metadata: {
    name: "Jupyter Notebook Demo",
    description: "Demonstration of Jupyter notebook support",
    language: "python",
    framework: "jupyter",
    runtime: "python",
    version: "3.11",
    entrypoint: "analysis.ipynb",
    tags: ["jupyter", "notebook", "python", "data-analysis"]
  },
  gpt_enabled: true,
  aiModelId: "gpt-4o-mini"
};
