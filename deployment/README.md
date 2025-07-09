# EuFMD Nexus Deployment

This document describes the deployment process and configuration for the EuFMD Nexus application on AWS EC2.

## Deployment Overview

The EuFMD Nexus application consists of:
- React frontend
- FastAPI backend
- MYSQL database (AWS RDS)

The application is deployed to an AWS EC2 instance which already hosts another application (TOM), requiring careful configuration to avoid conflicts.

## EC2 Server Environment

- **Server IP**: 13.49.235.70
- **User**: ubuntu
- **Existing Application**: TOM app (using ports 80, 443, 5000)
- **Directory Structure**:
  ```
  /var/www/
  ├── html/           # Default nginx directory
  ├── tms/            # TOM application
  ├── tps/            # Other existing directory
  └── eufmd-nexus/    # Our application (created during deployment)
      ├── frontend/   # React static files
      └── backend/    # FastAPI application
  ```

## Port Configuration

To avoid conflicts with the existing TOM application, we use the following ports:

| Service           | Port | Notes                                |
|-------------------|------|--------------------------------------|
| Frontend (Nginx)  | 8080 | TOM app uses port 80                 |
| Backend (FastAPI) | 5800 | TOM app uses port 5000               |
| Database (RDS)    | 5432 | AWS RDS PostgreSQL standard port     |

## Environment Variables

The application requires the following environment variables:

- `DB_HOST`: Database host URL
- `DB_USER`: Database username
- `DB_PASS`: Database password
- `DB_NAME`: Primary database name
- `DB2_NAME`: Secondary database name
- `SECRET_KEY`: Secret key for JWT tokens
- `SUPER_SECRET`: Another secret key for enhanced security
- `NODE_ENV`: Environment (set to "production" for deployment)
- `ALLOWED_ORIGINS`: List of allowed CORS origins

These variables are:
1. Set in CircleCI environment variables
2. Transferred to the server during deployment as a systemd environment file
3. Made available to the application through the systemd service

## Deployment Files

This folder contains the configuration files needed for deployment:

### `eufmd-nexus-api.service`

Systemd service file for running the FastAPI backend service. The service uses environment variables from a separate environment file.

```ini
[Unit]
Description=EuFMD Nexus API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/eufmd-nexus/backend
Environment=PATH=/var/www/eufmd-nexus/backend/venv/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/var/www/eufmd-nexus/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 5800
Restart=always
RestartSec=10
EnvironmentFile=/etc/eufmd-nexus/env

[Install]
WantedBy=multi-user.target
```

### `nginx-eufmd-nexus.conf`

Nginx configuration to serve the React frontend and proxy API requests to the backend.

```nginx
server {
    listen 8080;  # Use port 8080 instead of 80
    server_name 13.49.235.70;  # EC2 IP address
    
    root /var/www/eufmd-nexus/frontend;
    index index.html;
    
    # Frontend (React build)
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:5800;  # Forward to FastAPI backend
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static files
    location /static {
        alias /var/www/eufmd-nexus/frontend/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## SSH Connection Setup

To enable CircleCI to deploy to the EC2 instance:

1. Generated SSH key pair locally
2. Added public key to EC2's `~/.ssh/authorized_keys` file
3. Added private key to CircleCI project's SSH keys section
4. Updated CircleCI config with the key fingerprint

```bash
# Command used to generate SSH key (run locally)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/eufmd-nexus-key

# Adding public key to EC2 authorized_keys
cat ~/.ssh/eufmd-nexus-key.pub >> ~/.ssh/authorized_keys

# Testing SSH connection
ssh -i ~/.ssh/eufmd-nexus-key ubuntu@13.49.235.70
```

## CircleCI Configuration

The CircleCI configuration (`.circleci/config.yml`) handles automated deployment:

1. Builds the React frontend
2. Copies the built frontend and backend code to the EC2 instance
3. Sets up Python virtual environment and installs dependencies
4. Configures Nginx and systemd service
5. Restarts necessary services

Key environment variables are stored securely in CircleCI project settings:
- Database credentials
- Security keys and tokens
- Environment configuration
- CORS settings

### Environment Variables

The following environment variables must be set in the CircleCI project settings:

- `DB_HOST` - Database host URL
- `DB_USER` - Database username  
- `DB_PASS` - Database password
- `DB_NAME` - Primary database name
- `DB2_NAME` - Secondary database name
- `SECRET_KEY` - Secret key for JWT tokens
- `SUPER_SECRET` - Another secret key for enhanced security

These environment variables are used during the deployment process and transferred to the server's systemd environment file. They are never committed to the git repository for security reasons.

To set these environment variables in CircleCI:
1. Go to the CircleCI project settings
2. Navigate to Environment Variables
3. Add each variable with its respective value
4. Make sure to use the exact names as listed above

## Deployment Process

### Manual Deployment (First Time)

1. Create directory structure:
   ```bash
   sudo mkdir -p /var/www/eufmd-nexus/frontend /var/www/eufmd-nexus/backend
   sudo chown -R ubuntu:ubuntu /var/www/eufmd-nexus/
   ```

2. Copy deployment files:
   ```bash
   sudo cp eufmd-nexus-api.service /etc/systemd/system/
   sudo cp nginx-eufmd-nexus.conf /etc/nginx/sites-available/eufmd-nexus
   ```

3. Set up Nginx configuration:
   ```bash
   sudo ln -sf /etc/nginx/sites-available/eufmd-nexus /etc/nginx/sites-enabled/
   sudo nginx -t  # Test configuration
   sudo systemctl restart nginx
   ```

4. Set up Python environment and start service:
   ```bash
   cd /var/www/eufmd-nexus/backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   sudo systemctl daemon-reload
   sudo systemctl enable eufmd-nexus-api
   sudo systemctl start eufmd-nexus-api
   ```

5. Create environment variables file:
   ```bash
   sudo nano /etc/eufmd-nexus/env
   ```
   Add the following content, replacing with actual values:
   ```env
   DB_HOST=your_db_host
   DB_USER=your_db_user
   DB_PASS=your_db_pass
   DB_NAME=your_db_name
   DB2_NAME=your_db2_name
   SECRET_KEY=your_secret_key
   SUPER_SECRET=your_super_secret
   NODE_ENV=production
   ALLOWED_ORIGINS=*
   ```
   Save and exit the editor.

6. Set permissions for the environment file:
   ```bash
   sudo chown root:root /etc/eufmd-nexus/env
   sudo chmod 640 /etc/eufmd-nexus/env
   ```

### Automated Deployment (CircleCI)

1. Push changes to GitHub main branch
2. CircleCI automatically deploys to EC2
3. Access the application at http://13.49.235.70:8080

## Troubleshooting

### Check service status:
```bash
sudo systemctl status eufmd-nexus-api
sudo systemctl status nginx
```

### View logs:
```bash
sudo journalctl -u eufmd-nexus-api
sudo journalctl -u nginx
```

### Check ports in use:
```bash
sudo netstat -tuln
```

### Restart services after changes:
```bash
sudo systemctl restart eufmd-nexus-api
sudo systemctl restart nginx
```

## Future Improvements

- Set up HTTPS with Let's Encrypt
- Configure domain name (e.g., nexus.eufmd.org)
- Implement automated database migrations
- Add monitoring and alerting
- Set up load balancing for higher availability
