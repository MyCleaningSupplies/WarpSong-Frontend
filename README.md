# WarpSong Frontend

A modern, interactive music mixing application that allows users to create mashups, collaborate with others, and collect music stems.

## 🎵 Features

- **Stem Collection**: Scan QR codes to collect unique music stems
- **Solo Mode**: Create mashups by mixing different stems together
- **Collaborative Mixing**: Join sessions with friends to create music together
- **User Profiles**: Track your collected stems and created mashups
- **Gamification**: Earn XP and level up as you collect stems and create mashups

## 🛠️ Tech Stack

- **Frontend Framework**: React.js
- **Routing**: React Router
- **Audio Processing**: Tone.js
- **Real-time Communication**: Socket.IO
- **HTTP Client**: Axios
- **UI Components**: Custom components with Tailwind CSS
- **Icons**: Lucide React

## 🚀 Getting Started

### Prerequisites

- Node.js (v18.17.0 recommended)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/warpsong-frontend.git
cd warpsong-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## 📱 Application Structure

- **Authentication**: User registration, login, and profile management
- **Stem Player**: Interactive audio player for mixing stems
- **Solo Mode**: Create mashups on your own
- **Scan Page**: Scan QR codes to collect new stems
- **Profile**: View your collected stems and created mashups
- **Admin Panel**: Manage stems and users (admin only)

## 🔌 API Integration

The frontend connects to the WarpSong backend API for:
- User authentication
- Stem management
- Mashup creation and storage
- Real-time collaboration
- Gamification features

## 🎮 Gamification

The application includes gamification features:
- Earn XP for collecting stems and creating mashups
- Level up as you earn more XP
- Track your progress in your profile

## 🧩 Components

- **StemPlayer**: Core component for playing and mixing stems
- **SoloModePlayer**: Simplified player for creating mashups alone
- **Profile**: Display user information, stems, and mashups
- **ScanPage**: QR code scanner for collecting stems
- **LevelUpModal**: Displays level-up notifications

## 📦 Deployment

The application is configured for deployment on Vercel:

```bash
npm run build
```

## 🔒 Environment Variables

The application uses environment variables for API configuration:
- Development mode connects to localhost
- Production mode connects to the deployed backend

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.
