# EuFMD Nexus - React + FastAPI

A modern web application for the European Commission for the Control of Foot-and-Mouth Disease (EuFMD) management system.

## Architecture

- **Frontend**: React with TypeScript and Tailwind CSS
- **Backend**: Python FastAPI
- **Database**: MySQL with multiple databases (db_manager, PCP, RMT, db_training)

## Deployment

For detailed deployment instructions, please refer to the [deployment documentation](./deployment/README.md).

## Installation

### Prerequisites

- Node.js (v18.15.0 or higher)
- Python (v3.8 or higher)
- MySQL Server

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   ```bash
   # On Windows
   venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Database Setup

1. Follow tutorial: https://eufmd-fast-docs.onrender.com/blog/testing-environment

2. The App uses 2 databases: db_manager and PCP. You must import all 2 databases on your local MySQL.

3. Copy the `.env.example` file to `.env` and configure your database credentials.

## Running the Application

### Development Mode

1. Start the backend server:
   ```bash
   cd backend
   uvicorn main:app --reload --port 5800
   ```

2. Start the frontend development server:
   ```bash
   cd frontend
   npm start
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5800
- API Documentation: http://localhost:5800/docs

### Production Mode

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. The FastAPI backend can serve the built React app in production.

## Features

- **Risk Management Tool (RMT)**: Disease risk assessment and management
- **Progressive Control Pathway (PCP)**: FMD control program management
- **Training Management**: Course and enrollment management
- **Diagnostic Support**: Laboratory and diagnostic tools
- **Emergency Response**: Emergency toolbox and fast reporting
- **User Authentication**: JWT-based authentication system

## Deployment

For detailed deployment instructions and configuration details, please refer to the [deployment README](deployment/README.md). The deployment folder contains all necessary configuration files and documentation for deploying to AWS EC2 with CircleCI automation.

Key deployment files:
- `deployment/eufmd-nexus-api.service` - Systemd service configuration
- `deployment/nginx-eufmd-nexus.conf` - Nginx server configuration
- `deployment/README.md` - Comprehensive deployment guide

## API Documentation

The FastAPI backend provides automatic API documentation available at `/docs` when running the server.



### Branching Strategy

The reference branch is `staging`. Always pull from and merge changes into the `staging` branch.

### Workflow

1. Pull the latest changes from `staging`
2. Create a new branch for your work
3. Work on your changes and commit them
4. Merge changes from development
5. Push your branch and create a Pull Request

## License

[License information]
