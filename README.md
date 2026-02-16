# MyCloud - Self-Hosted Cloud Storage Solution

A comprehensive, self-hosted cloud storage platform with admin-managed user system, file upload/download capabilities, folder management, and a modern user interface.

## Features

- **Admin-Managed Users** - Streamlined user management without email verification requirements
- **File Management** - Complete file lifecycle management including upload, download, and deletion
- **Folder Organization** - Hierarchical folder structure for efficient file organization
- **File Sharing** - Share files securely via public links
- **Storage Quotas** - Configurable storage limits per user
- **Modern Interface** - Built with React and Tailwind CSS for a responsive, intuitive experience
- **Docker Support** - Containerized deployment for easy setup and maintenance
- **JWT Authentication** - Secure token-based authentication system

## Quick Start for Local Network use. 
For home networks with direct access without HTTPS or reverse proxy complexity.

See here for [Production/Online use Configuration](#quick-start-for-online-use-with-docker-and-https)

### Prerequisites
- Docker and Docker Compose installed
- Network-connected device (Raspberry Pi, server, or desktop)
- Minimum 1GB available storage space

### Installation

1. **Navigate to the project directory**
```bash
cd mycloud
```

2. **Create a local network configuration**
```bash
cp .env.local.example .env
nano .env
```

⚠️ **IMPORTANT:** You MUST edit `.env` before proceeding!

**Required changes:**
- `JWT_SECRET` - Set a strong, random secret key (minimum 32 characters)
- `ADMIN_PASSWORD` - Set a secure administrator password

Generate a secure JWT_SECRET:
```bash
openssl rand -base64 32
```

3. **Build and launch**
```bash
sudo docker compose -f docker-compose.local.yml up -d --build
```

4. **Find your device's IP address**
```bash
# On Linux/Mac
hostname -I | awk '{print $1}'

# Or
ip addr show | grep "inet " | grep -v 127.0.0.1
```

5. **Access MyCloud from any device on your network**

Open a browser and navigate to:
- `http://[YOUR-IP]:6868` (e.g., `http://192.168.1.100:6868`)
- OR `http://[HOSTNAME].local:6868` (e.g., `http://pi5.local:6868`)

**Default credentials:**
- Username: `admin`
- Password: `admin123` (or the value you set in `.env`)

### Optional: Set a Static IP Address

For consistent access, configure a static IP on your device:

**On Raspberry Pi/Ubuntu:**
```bash
# Edit netplan configuration
sudo nano /etc/netplan/01-netcfg.yaml
```

Example configuration:
```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses:
        - 192.168.1.100/24
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
```

Apply changes:
```bash
sudo netplan apply
```

### Management Commands

```bash
# View logs
docker compose -f docker-compose.local.yml logs -f

# Restart
docker compose -f docker-compose.local.yml restart

# Stop
docker compose -f docker-compose.local.yml down

# Update and rebuild
docker compose -f docker-compose.local.yml down
docker compose -f docker-compose.local.yml up -d --build
```

### Accessing from Mobile Devices

1. Ensure your mobile device is on the same WiFi network
2. Open browser and navigate to `http://[YOUR-IP]:6868`
3. Add to home screen for quick access (works like a native app)

### Network Considerations

- **Firewall:** Ensure port 6868 is open if using a firewall
- **Router DNS:** Consider adding a DNS entry in your router for easier access
- **Security:** This setup uses HTTP (not HTTPS). Only use within trusted local networks
- **Port Forwarding:** Do NOT expose port 6868 to the internet without proper security measures

## Quick Start for online use with Docker and Https

For the public or online use, or in production

### Prerequisites
- Docker and Docker Compose installed
- Letsencrypt or other certificate service installed
- Apache2 or Nginx installed
- Minimum 1GB available storage space

### Installation

1. **Navigate to the project directory**
```bash
cd mycloud
```

2. **Configure environment variables**
```bash
cp .env.example .env
```

⚠️ **IMPORTANT:** You MUST edit `.env` before proceeding!

**Required changes:**
- `JWT_SECRET` - Set a strong, random secret key (minimum 32 characters)
- `ADMIN_PASSWORD` - Set a secure administrator password

Example of generating a secure JWT_SECRET:
```bash
openssl rand -base64 32

# Or use any random string generator
```

3. **Configure Web Server / Reverse Proxy**
- Apache Web Server is tested, Nginx should work too.
- Generate Certificates with Letsencrypt
- See the detailed [Web Server Configuration](#option-a-apache-subdirectory-deployment---tested--verified) section below for complete setup instructions.

4. **Build the frontend**
```bash
cd client
npm install
npm run build
cd ..
```

5. **Launch with Docker Compose**
```bash
sudo docker compose up -d
```

6. **Access MyCloud**
Open your browser and navigate to: `https://yourdomain.com/cloud`

**Default credentials:**
- Username: `admin`
- Password: `admin123` (or the value set in `.env`)

## Manual Installation (without Docker)

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Backend Setup

1. **Install dependencies**
```bash
npm install
```

2. **Configure environment (CRITICAL STEP!)**
```bash
cp .env.example .env
```

⚠️ **SECURITY WARNING:** Edit `.env` and change at minimum:
- `JWT_SECRET` - Strong secret key (minimum 32 characters)
- `ADMIN_PASSWORD` - Secure password (NOT "admin123")

3. **Start the server**
```bash
npm start
```

The server will be available at `http://localhost:6868`

### Frontend Development

1. **Navigate to client directory**
```bash
cd client
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

The frontend will be available at `http://localhost:6869` with hot-reload enabled

### Production Build

```bash
# Build frontend
cd client
npm run build

# Start server in production mode
cd ..
NODE_ENV=production npm start
```

## Usage Guide

### Administrator Functions

1. **Login** with admin credentials
2. **Access Admin Panel** via the settings icon in the header
3. **Create Users:**
   - Click "Create User"
   - Enter username, email, and password
   - Set storage quota (in GB)
   - Click "Create User"

4. **Manage Users:**
   - View all users and their storage utilization
   - Delete users as needed

### User Functions

1. **Login** with credentials provided by administrator
2. **Upload Files:**
   - Drag and drop files into the upload zone
   - Or click to select files manually

3. **Create Folders:**
   - Click "New Folder"
   - Enter folder name

4. **Manage Files:**
   - **Download:** Click the download icon
   - **Share:** Click the share icon (link copied to clipboard)
   - **Delete:** Click the trash icon

5. **Navigate:**
   - Click folders to open them
   - Click the back arrow to navigate to parent folder

## Configuration

### Environment Variables (.env)

```env
# Server Configuration
PORT=6868                    # Server port
NODE_ENV=production          # Environment: production or development

# Security
JWT_SECRET=your-secret-key   # CRITICAL: Change this in production!

# Database
DB_PATH=./data/database.sqlite

# File Storage
UPLOAD_PATH=./data/uploads
MAX_FILE_SIZE=524288000      # 500MB in bytes

# Default Admin User
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123      # CRITICAL: Change this in production!
ADMIN_EMAIL=admin@mycloud.local
```

### Storage Quotas

Default quota per user: **10 GB**

This can be customized when creating users in the Admin Panel.

## Production Deployment

### Docker Deployment (Recommended)

1. **Transfer files to server**
```bash
scp -r mycloud user@your-server.com:/home/user/
```

2. **Connect to server**
```bash
ssh user@your-server.com
cd mycloud
```

3. **Configure environment (CRITICAL - DO NOT SKIP!)**
```bash
nano .env
```

⚠️ **PRODUCTION SECURITY:** You MUST change these values:
- `JWT_SECRET` - Use a strong random string (minimum 32 characters)
- `ADMIN_PASSWORD` - Use a secure password

Generate a secure JWT_SECRET:
```bash
openssl rand -base64 32
```

4. **Start Docker containers**
```bash
docker-compose up -d
```

5. **Configure Reverse Proxy (Optional)**

You can deploy MyCloud either at the root of a domain or in a subdirectory.

#### Option A: Apache (Subdirectory Deployment - Tested & Verified)

This configuration serves MyCloud at `https://yourdomain.com/cloud`

**Enable required Apache modules:**
```bash
sudo a2enmod proxy proxy_http rewrite headers ssl
sudo systemctl restart apache2
```

**Add to your Apache VirtualHost configuration:**
```apache
<VirtualHost *:443>
    ServerName yourdomain.com

    ```
    # SSL Configuration
    SLEngine on
    SSLCertificateFile /etc/letsencrypt/live/yourdomain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/yourdomain.com/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
    ```

    # MyCloud Proxy Configuration
    ProxyPreserveHost On
    ProxyRequests Off

    # Allow large file uploads (500MB)
    LimitRequestBody 524288000

    # Rewrite Engine for MyCloud
    RewriteEngine On

    # Forward all /cloud/* requests to backend
    RewriteCond %{REQUEST_URI} ^/cloud
    RewriteRule ^/cloud/?(.*) http://localhost:6868/$1 [P,L]

    ProxyPassReverse /cloud http://localhost:6868/

    <Location /cloud>
        RequestHeader set X-Forwarded-Proto "https"
        RequestHeader set X-Real-IP %{REMOTE_ADDR}s
        RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
    </Location>
</VirtualHost>
```

**Restart Apache:**
```bash
sudo systemctl restart apache2
```

Access your MyCloud at: `https://yourdomain.com/cloud`

#### Option B: Nginx (Root Domain Deployment)

This configuration serves MyCloud at `https://cloud.yourdomain.com`

**Create `/etc/nginx/sites-available/mycloud`:**
```nginx
server {
    listen 80;
    server_name cloud.yourdomain.com;

    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:6868;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Enable site and configure SSL with Let's Encrypt:**
```bash
sudo ln -s /etc/nginx/sites-available/mycloud /etc/nginx/sites-enabled/
sudo certbot --nginx -d cloud.yourdomain.com
sudo systemctl reload nginx
```

Access your MyCloud at: `https://cloud.yourdomain.com`

#### Option C: Nginx (Subdirectory Deployment)

This configuration serves MyCloud at `https://yourdomain.com/cloud`

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    client_max_body_size 500M;

    location /cloud {
        rewrite ^/cloud/(.*) /$1 break;
        proxy_pass http://localhost:6868;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Container Management

```bash
# View logs
docker-compose logs -f

# Restart containers
docker-compose restart

# Stop containers
docker-compose down

# Update containers
docker-compose pull
docker-compose up -d --build
```

## Project Structure

```
mycloud/
├── server/               # Backend (Node.js/Express)
│   ├── index.js         # Main server file
│   ├── database/        # Database initialization
│   ├── middleware/      # Authentication middleware
│   └── routes/          # API routes
├── client/              # Frontend (React)
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Application pages
│   │   ├── store/       # State management
│   │   └── api/         # API client
│   └── package.json
├── data/                # Runtime data (created on first run)
│   ├── database.sqlite  # SQLite database
│   └── uploads/         # User uploaded files
├── docker-compose.yml   # Docker configuration
├── Dockerfile
└── README.md
```

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- Helmet.js security headers
- Rate limiting
- Input validation
- **IMPORTANT:** Change `JWT_SECRET` and `ADMIN_PASSWORD` before production deployment!

## Database

The application uses SQLite for simplified deployment. The database is automatically initialized on first startup.

**Tables:**
- `users` - User account information
- `files` - File metadata
- `folders` - Folder structure
- `shared_files` - File sharing information

## Troubleshooting

### "Cannot connect to server"
- Verify server is running: `docker-compose ps`
- Check logs: `docker-compose logs`
- Ensure port 6868 is available

### "Upload failed - Storage quota exceeded"
- Administrator can increase quota in Admin Panel
- User can delete old files to free up space

### "Database locked"
- SQLite supports only one concurrent write operation
- Consider migrating to PostgreSQL/MySQL for high-traffic deployments

## Technology Stack

**Backend:**
- Node.js
- Express.js
- SQLite
- JWT for authentication
- bcrypt for password hashing

**Frontend:**
- React
- Tailwind CSS
- Zustand for state management
- Vite for build tooling

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Create new user (admin only)

### Files
- `GET /api/files` - List files
- `POST /api/files/upload` - Upload file
- `GET /api/files/download/:id` - Download file
- `DELETE /api/files/:id` - Delete file
- `POST /api/files/share/:id` - Create share link

### Folders
- `GET /api/folders` - List folders
- `POST /api/folders` - Create folder
- `DELETE /api/folders/:id` - Delete folder

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `DELETE /api/users/:id` - Delete user

## Using External Storage

By default, MyCloud stores data in a Docker volume. To use an external disk or different location:

### Method 1: Bind Mount (Recommended)

Edit your `docker-compose.yml` or `docker-compose.local.yml`:

```yaml
services:
  mycloud:
    # ... other settings ...
    volumes:
      - /mnt/external-disk/mycloud-data:/app/data
```

**Linux/Raspberry Pi example:**
```yaml
volumes:
  - /mnt/usb-drive/mycloud:/app/data
```

**Windows example:**
```yaml
volumes:
  - D:/MyCloud/data:/app/data
```

### Method 2: Named Volume with Custom Location

```yaml
volumes:
  mycloud-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/external-disk/mycloud-data
```

### Migration Steps

If you already have existing data and want to move it:
⚠️ Careful, this example uses the compose file  for local network usage, use docker-compose.yml otherwise!

```bash
# 1. Stop the container
sudo docker compose -f docker-compose.local.yml down

# 2. Create directory on external disk
sudo mkdir -p /mnt/external-disk/mycloud-data

# 3. Copy existing data from Docker volume
sudo docker run --rm \
  -v mycloud-data:/from \
  -v /mnt/external-disk/mycloud-data:/to \
  alpine cp -a /from/. /to/

# 4. Set proper permissions
sudo chown -R 1000:1000 /mnt/external-disk/mycloud-data

# 5. Update docker-compose file with new path
# Change volumes section to use bind mount:
#   volumes:
#     - /mnt/external-disk/mycloud-data:/app/data
# And REMOVE the volumes: definition at the bottom (mycloud-data:)

# 6. Remove old Docker volume completely
# ⚠️This will delete your data if not copied before!⚠️
sudo docker volume rm mycloud_mycloud-data
# If it fails, use: sudo docker compose -f docker-compose.local.yml down -v

# 7. Verify volume is removed
sudo docker volume ls | grep mycloud

# 8. Start container with new location
sudo docker compose -f docker-compose.local.yml up -d

# 9. Verify it's using the correct location
docker inspect mycloud | grep -A 5 Mounts
ls -la /mnt/external-disk/mycloud-data/
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Verify all environment variables are properly set
3. Ensure port 6868 is not already in use
4. Review the troubleshooting section above

## Contributing

Contributions are welcome. Please ensure all tests pass before submitting pull requests.

---

**MyCloud - Your data, your control**
