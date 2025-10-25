# MyCloud - Moderne Self-Hosted Cloud-Lösung

Eine vollständige, selbst gehostete Cloud-Speicherlösung mit admin-verwaltetem Benutzersystem, Datei-Upload/Download, Ordnerverwaltung und modernem UI.

## ✨ Features

- 🔐 **Admin-verwaltete Benutzer** - Keine E-Mail-Verifikation, Admins legen Benutzer an
- 📁 **Datei-Management** - Upload, Download, Löschen von Dateien
- 📂 **Ordner-Struktur** - Organisieren Sie Dateien in Ordnern
- 🔗 **Datei-Sharing** - Teilen Sie Dateien über öffentliche Links
- 💾 **Speicher-Quotas** - Individuelle Speicherlimits pro Benutzer
- 🎨 **Modernes UI** - React + Tailwind CSS Interface
- 🐳 **Docker-Ready** - Einfaches Deployment auf jedem Server
- 🔒 **JWT Authentifizierung** - Sichere Token-basierte Authentifizierung

## 🚀 Schnellstart mit Docker

### Voraussetzungen
- Docker & Docker Compose installiert
- Mindestens 1GB freier Speicherplatz

### Installation

1. **Repository klonen oder herunterladen**
```bash
cd mycloud
```

2. **Umgebungsvariablen konfigurieren**
```bash
cp .env.example .env
```

Bearbeiten Sie `.env` und ändern Sie mindestens:
- `JWT_SECRET` - Wählen Sie einen starken Geheimschlüssel
- `ADMIN_PASSWORD` - Setzen Sie ein sicheres Admin-Passwort

3. **Mit Docker Compose starten**
```bash
docker-compose up -d
```

4. **Zugriff auf MyCloud**
Öffnen Sie Ihren Browser und navigieren zu: `http://localhost:6868`

**Standard-Login:**
- Benutzername: `admin`
- Passwort: `admin123` (oder was Sie in `.env` gesetzt haben)

## 🛠️ Manuelle Installation (ohne Docker)

### Voraussetzungen
- Node.js 18 oder höher
- npm oder yarn

### Backend Setup

1. **Dependencies installieren**
```bash
npm install
```

2. **Umgebungsvariablen konfigurieren**
```bash
cp .env.example .env
# Bearbeiten Sie .env nach Bedarf
```

3. **Server starten**
```bash
npm start
```

Der Server läuft nun auf `http://localhost:6868`

### Frontend Development

1. **In das Client-Verzeichnis wechseln**
```bash
cd client
```

2. **Dependencies installieren**
```bash
npm install
```

3. **Development Server starten**
```bash
npm run dev
```

Das Frontend läuft auf `http://localhost:6869` mit Hot-Reload

### Production Build

```bash
# Frontend bauen
cd client
npm run build

# Server im Production-Modus starten
cd ..
NODE_ENV=production npm start
```

## 📋 Verwendung

### Als Admin

1. **Login** mit Admin-Credentials
2. **Navigieren Sie zu Admin Panel** (Settings-Icon in der Header)
3. **Benutzer erstellen:**
   - Klicken Sie auf "Benutzer erstellen"
   - Füllen Sie Benutzername, E-Mail, Passwort aus
   - Setzen Sie Speicher-Quota (in GB)
   - Klicken Sie auf "Benutzer erstellen"

4. **Benutzer verwalten:**
   - Sehen Sie alle Benutzer und deren Speichernutzung
   - Löschen Sie Benutzer bei Bedarf

### Als Benutzer

1. **Login** mit vom Admin zugewiesenen Credentials
2. **Dateien hochladen:**
   - Drag & Drop in die Upload-Zone
   - Oder klicken und Dateien auswählen
   
3. **Ordner erstellen:**
   - Klicken Sie auf "Neuer Ordner"
   - Geben Sie einen Namen ein
   
4. **Dateien verwalten:**
   - **Download:** Klicken Sie auf Download-Icon
   - **Teilen:** Klicken Sie auf Share-Icon (Link wird kopiert)
   - **Löschen:** Klicken Sie auf Papierkorb-Icon
   
5. **Navigation:**
   - Klicken Sie auf Ordner zum Öffnen
   - Klicken Sie auf Zurück-Pfeil für übergeordneten Ordner

## 🔧 Konfiguration

### Umgebungsvariablen (.env)

```env
# Server
PORT=6868                    # Server Port
NODE_ENV=production          # production oder development

# Sicherheit
JWT_SECRET=your-secret-key   # WICHTIG: Ändern Sie dies!

# Datenbank
DB_PATH=./data/database.sqlite

# Datei-Speicher
UPLOAD_PATH=./data/uploads
MAX_FILE_SIZE=524288000      # 500MB in Bytes

# Standard Admin-User
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123      # WICHTIG: Ändern Sie dies!
ADMIN_EMAIL=admin@mycloud.local
```

### Speicher-Quotas

Standard-Quota pro Benutzer: **10 GB**

Sie können dies beim Erstellen eines Benutzers im Admin-Panel anpassen.

## 🌐 Deployment auf Rootserver

### Mit Docker (Empfohlen)

1. **Dateien auf Server übertragen**
```bash
scp -r mycloud user@your-server.com:/home/user/
```

2. **Auf Server verbinden**
```bash
ssh user@your-server.com
cd mycloud
```

3. **.env konfigurieren**
```bash
nano .env
# Setzen Sie sichere Werte für JWT_SECRET und ADMIN_PASSWORD
```

4. **Docker Container starten**
```bash
docker-compose up -d
```

5. **Nginx Reverse Proxy (Optional)**

Erstellen Sie `/etc/nginx/sites-available/mycloud`:

```nginx
server {
    listen 80;
    server_name cloud.ihre-domain.de;

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
    }
}
```

Aktivieren und SSL mit Let's Encrypt:
```bash
sudo ln -s /etc/nginx/sites-available/mycloud /etc/nginx/sites-enabled/
sudo certbot --nginx -d cloud.ihre-domain.de
sudo systemctl reload nginx
```

### Container-Management

```bash
# Logs anzeigen
docker-compose logs -f

# Container neustarten
docker-compose restart

# Container stoppen
docker-compose down

# Updates durchführen
docker-compose pull
docker-compose up -d --build
```

## 🗂️ Projektstruktur

```
mycloud/
├── server/               # Backend (Node.js/Express)
│   ├── index.js         # Haupt-Server
│   ├── database/        # Datenbank-Setup
│   ├── middleware/      # Auth-Middleware
│   └── routes/          # API-Routen
├── client/              # Frontend (React)
│   ├── src/
│   │   ├── components/  # React-Komponenten
│   │   ├── pages/       # Seiten
│   │   ├── store/       # Zustand-Management
│   │   └── api/         # API-Client
│   └── package.json
├── data/                # Laufzeit-Daten (wird erstellt)
│   ├── database.sqlite  # SQLite Datenbank
│   └── uploads/         # Hochgeladene Dateien
├── docker-compose.yml   # Docker-Konfiguration
├── Dockerfile
└── README.md
```

## 🔒 Sicherheit

- ✅ JWT-basierte Authentifizierung
- ✅ Passwort-Hashing mit bcrypt
- ✅ CORS-Protection
- ✅ Helmet.js Security Headers
- ✅ Rate Limiting
- ✅ Input Validation
- ⚠️ **WICHTIG:** Ändern Sie `JWT_SECRET` und `ADMIN_PASSWORD` in Produktion!

## 📊 Datenbank

Die Anwendung verwendet SQLite für einfaches Deployment. Die Datenbank wird automatisch beim ersten Start initialisiert.

**Tabellen:**
- `users` - Benutzerdaten
- `files` - Datei-Metadaten
- `folders` - Ordner-Struktur
- `shared_files` - Datei-Sharing-Informationen

## 🐛 Troubleshooting

### Problem: "Cannot connect to server"
- Prüfen Sie ob der Server läuft: `docker-compose ps`
- Prüfen Sie die Logs: `docker-compose logs`
- Stellen Sie sicher Port 6868 ist frei

### Problem: "Upload failed - Storage quota exceeded"
- Admin kann im Admin-Panel das Quota erhöhen
- Oder alte Dateien löschen

### Problem: "Database locked"
- SQLite unterstützt nur einen Schreibzugriff gleichzeitig
- Bei hoher Last zu PostgreSQL/MySQL migrieren

## 📝 Lizenz

MIT License - Frei verwendbar für private und kommerzielle Projekte

## 🤝 Support

Bei Fragen oder Problemen:
1. Prüfen Sie die Logs: `docker-compose logs -f`
2. Stellen Sie sicher alle Umgebungsvariablen sind gesetzt
3. Prüfen Sie dass Port 6868 nicht bereits verwendet wird

---

**Viel Erfolg mit Ihrer MyCloud! ☁️**
