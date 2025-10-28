# نظام إدارة بيانات الناخبين - حملة المرشح علاء سليمان الحديوي

## Overview
This project is an integrated system designed for managing voter data for an election campaign. It comprises:
1.  **Telegram Bot**: For collecting voter data from field representatives.
2.  **Web Control Panel**: For displaying and analyzing the collected data.

The system aims to streamline voter data collection, provide comprehensive analytics, and enhance the efficiency of election campaigns. It focuses on secure data handling, intelligent data extraction, and user-friendly interfaces for both representatives and administrators.

## User Preferences
*   All components should support Arabic language (RTL).
*   Prioritize fast performance and optimized image processing for the Telegram Mini App.
*   Emphasize secure data handling and restricted access to sensitive information.
*   The system should automatically detect and configure environment variables where possible (e.g., `RENDER_EXTERNAL_URL`).

## System Architecture

### UI/UX Decisions
*   **Design System**: Material Design.
*   **Typography**: Cairo font for Arabic text.
*   **Theming**: Automatic dark/light mode support.
*   **Responsiveness**: Fully responsive design for all devices, with bottom navigation for mobile and side navigation for desktop.
*   **Web Control Panel Pages**:
    *   `/`: Main dashboard with statistics and charts.
    *   `/voters`: Voter list with search and details.
    *   `/representatives`: Management and performance tracking of representatives.
    *   `/analytics`: Advanced analytics.

### Technical Implementations

*   **Frontend**: React + TypeScript.
*   **Backend**: Node.js + Express.
*   **Telegram Bot Workflow**:
    *   **Mini App (Recommended)**: Secure identity verification, smart camera with guiding frame optimized for Egyptian ID cards (1.57:1 aspect ratio), intelligent edge detection with visual indicators, automatic quality assessment (lighting, clarity), and instant automatic capture.
    *   **OCR**: Immediate OCR extraction from ID card images, displaying national ID, name, and address.
    *   **Data Completion**: Representatives fill in location, family, phone number, and political stance.
    *   **Saving**: Image upload to storage and data saving to Sheets.
*   **Data Processing**:
    *   **OCR Integration**: Extracts data from ID card images.
    *   **Egyptian ID Decoder**: Deciphers national ID to extract birth date, governorate, and gender.
    *   **Age Calculator**: Calculates age and identifies seniors (60+).
*   **Security**:
    *   Secure login for the web panel using username and password.
    *   Authentication and authorization for Telegram bot users (representatives).
    *   Private and protected storage of ID card images with restricted access.

### Feature Specifications

*   **Dashboard**: Secure login, comprehensive statistics (total, supporter, opponent, neutral), senior citizen statistics (60+) with gender distribution and required vehicle calculation, gender distribution, interactive charts, advanced voter search, voter details with image and location, representative management (add, edit, delete), representative statistics with senior data, family-based analytics.
*   **Telegram Bot**: Secure representative verification, enhanced OCR for ID cards (fast extraction, improved image processing, Arabic/Hindi digit support, 80-95% accuracy), smart national ID decoding (birth date, governorate, gender), data validation, automatic image upload, instant data saving.

### System Design Choices

*   **OAuth 2.0**: Enabled for Google integrations for easier setup, direct user account access, and enhanced security.
*   **Data Model**:
    *   **Voters**: `id`, `nationalId`, `fullName`, `familyName`, `phoneNumber`, `latitude`, `longitude`, `stance`, `idCardImageUrl`, `representativeId`, `representativeName`, `createdAt`.
    *   **Representatives**: `userId`, `name`, `totalVoters`, `lastActiveAt`, senior citizen stats, gender distribution.

## External Dependencies

*   **Google Sheets**: Primary database for voter and representative data.
*   **Wasabi S3**: Cloud storage for uploading and storing ID card images (alternative to Google Drive).
*   **Google Drive (Legacy)**: Support for older images uploaded to Google Drive.
*   **Hugging Face (Optional)**: Used for enhanced OCR capabilities (requires `HUGGINGFACE_TOKEN`).
*   **Telegram Bot API**: For communication with the Telegram platform.
*   **Google OAuth 2.0**: For authentication and authorization with Google services.