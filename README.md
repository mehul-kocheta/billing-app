# Billing App

A simple, desktop-based billing application built with React and Electron. This app allows you to easily generate invoices, save your company configurations automatically, map products to HSN codes, and export your invoices to PDF or a physical printer.

## Prerequisites

- [Node.js](https://nodejs.org/) (Version 16 or newer recommended)

## Installation

1. **Clone or Download** the repository to your local machine.
2. **Open a terminal** (or Command Prompt / PowerShell) and navigate into the project directory:
   ```bash
   cd "path/to/Billing App"
   ```
3. **Install Dependencies**:
   ```bash
   npm install
   ```

## Running the App

To run the application in development mode, simply use:

```bash
npm run dev
```

This will automatically launch the Electron desktop window. Any changes you make to the code will hot-reload in the app instantly.

## Building for Production

If you want to compile the app into a standalone Windows Executable (`.exe`) that can be shared or run without Node.js, run:

```bash
npm run build:win
```

Once the build process completes, you will find a setup file located in the `dist-electron` folder.

## Features
- **Editable UI**: Edit the company name, address, customer details, and bank info directly by clicking on them.
- **Dynamic Rows**: Add or remove products to the invoice.
- **Auto-Calculation**: Totals and tax amounts calculate automatically based on inputs.
- **Auto-Saving**: Your company settings and configurations persist locally in your user data directory.
- **Print to PDF**: Use the print button to generate a clean, professional invoice hiding all interactive UI elements.
