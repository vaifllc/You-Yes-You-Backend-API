# YOU YES YOU - Backend API

A comprehensive backend system for the YOU YES YOU digital community platform, designed for formerly incarcerated fathers focused on personal development, family restoration, and financial empowerment.

## 🚀 Features

### Core Functionality
- **User Authentication & Authorization** - JWT-based auth with role management
- **Community Posts & Comments** - Full CRUD with categories and moderation
- **Course Management** - Multi-module courses with progress tracking
- **Event System** - Calendar events with RSVP and attendance tracking
- **Gamification** - Points, levels, achievements, and leaderboards
- **Admin Dashboard** - Complete platform management and analytics
- **File Uploads** - Image handling with Cloudinary integration
- **Real-time Features** - Socket.IO for live updates

### Security Features
- Password hashing with bcrypt
- JWT token authentication
- Rate limiting and request throttling
- CORS protection
- Input validation and sanitization
- Helmet security headers
- Role-based access control

## 📋 Prerequisites

Before running this application, make sure you have:

- **Node.js** (v18 or higher)
- **MongoDB** (v5 or higher)
- **npm** or **yarn**

## 🛠️ Installation

1. **Clone and navigate to the server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` with your actual values:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/youyesyou
   JWT_SECRET=your-super-secret-jwt-key
   # ... other variables
   ```

4. **Start MongoDB** (if running locally):
   ```bash
   mongod
   ```

5. **Seed the database** (optional but recommended):
   ```bash
   npm run seed
   ```

6. **Start the development server:**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:5000`

## 📚 API Documentation

### Authentication Endpoints
```
POST /api/auth/register     - Register new user
POST /api/auth/login        - Login user
GET  /api/auth/me           - Get current user
PUT  /api/auth/profile      - Update profile
PUT  /api/auth/password     - Change password
POST /api/auth/logout       - Logout user
```

### User Management
```
GET  /api/users             - Get all users (paginated)
GET  /api/users/:id         - Get user profile
GET  /api/users/:id/posts   - Get user's posts
PUT  /api/users/status      - Update online status
```

### Community Posts
```
GET    /api/posts           - Get all posts (with filters)
GET    /api/posts/:id       - Get single post
POST   /api/posts           - Create new post
PUT    /api/posts/:id       - Update post
DELETE /api/posts/:id       - Delete post
PUT    /api/posts/:id/like  - Like/unlike post
POST   /api/posts/:id/comments     - Add comment
PUT    /api/posts/:postId/comments/:commentId - Update comment
DELETE /api/posts/:postId/comments/:commentId - Delete comment
```

### Resources & Directory
```
GET    /api/resources               - Get all resources
GET    /api/resources/:id           - Get single resource
POST   /api/resources               - Submit new resource
POST   /api/resources/:id/reviews   - Add resource review
GET    /api/resources/categories    - Get resource categories
GET    /api/resources/admin/pending - Get pending resources (Admin)
PUT    /api/resources/:id/moderate  - Approve/reject resource (Admin)
PUT    /api/resources/:id           - Update resource (Admin)
DELETE /api/resources/:id           - Delete resource (Admin)
```

### Messaging System
```
GET    /api/messages/conversations     - Get user's conversations
GET    /api/messages/conversations/:id - Get conversation messages
POST   /api/messages/conversations     - Start new conversation
POST   /api/messages/conversations/:id - Send message
PUT    /api/messages/:id              - Edit message
DELETE /api/messages/:id              - Delete message
PUT    /api/messages/conversations/:id/read - Mark conversation as read
```

### Connection Requests
```
POST   /api/connections/request    - Send connection request
PUT    /api/connections/:id/respond - Respond to request
GET    /api/connections            - Get user's connections
GET    /api/connections/pending    - Get pending requests
DELETE /api/connections/:id        - Cancel request
GET    /api/connections/templates  - Get connection templates
GET    /api/connections/stats      - Get connection statistics
PUT    /api/connections/:id/block  - Block connection
```

### Content Moderation
```
POST   /api/moderation/report       - Report content
GET    /api/moderation/dashboard    - Moderation dashboard (Admin)
GET    /api/moderation/reports      - Get all reports (Admin)
PUT    /api/moderation/reports/:id  - Handle report (Admin)
GET    /api/moderation/stats        - Moderation statistics (Admin)
GET    /api/moderation/analyze/:userId - Analyze user behavior (Admin)
PUT    /api/moderation/bulk         - Bulk moderate reports (Admin)
```

### Challenges & Gamification
```
GET    /api/challenges              - Get all challenges
GET    /api/challenges/:id          - Get single challenge
GET    /api/challenges/my-challenges - Get user's challenges
POST   /api/challenges/:id/join     - Join challenge
PUT    /api/challenges/:id/progress - Update challenge progress
GET    /api/challenges/:id/leaderboard - Get challenge leaderboard
POST   /api/challenges              - Create challenge (Admin)
PUT    /api/challenges/:id          - Update challenge (Admin)
DELETE /api/challenges/:id          - Delete challenge (Admin)
```

### Badges & Achievements
```
GET    /api/badges                  - Get all badges
GET    /api/badges/my-badges        - Get user's badges
POST   /api/badges/check-eligibility - Check for new badges
POST   /api/badges                  - Create badge (Admin)
PUT    /api/badges/:id              - Update badge (Admin)
DELETE /api/badges/:id              - Delete badge (Admin)
POST   /api/badges/:id/award        - Manually award badge (Admin)
```

### Rewards System
```
GET    /api/rewards                 - Get all rewards
GET    /api/rewards/:id             - Get single reward
GET    /api/rewards/my-rewards      - Get user's claimed rewards
POST   /api/rewards/:id/claim       - Claim reward
GET    /api/rewards/admin/claims    - Get reward claims (Admin)
POST   /api/rewards                 - Create reward (Admin)
PUT    /api/rewards/:id             - Update reward (Admin)
```

### Third-party Integrations
```
GET    /api/integrations            - Get all integrations (Admin)
GET    /api/integrations/api-key    - Get API key for external use (Admin)
POST   /api/integrations            - Create integration (Admin)
PUT    /api/integrations/:id        - Update integration (Admin)
POST   /api/integrations/:id/test   - Test integration (Admin)
POST   /api/integrations/zapier/trigger - Trigger Zapier webhook
GET    /api/integrations/external/users - Get users for external services
GET    /api/integrations/external/users/:id/courses - Get user courses
GET    /api/integrations/external/users/:id/events - Get user events
```

### Courses & Learning
```
GET  /api/courses                      - Get all courses
GET  /api/courses/:id                  - Get single course
POST /api/courses/:id/enroll           - Enroll in course
PUT  /api/courses/:id/progress         - Update progress
GET  /api/courses/my-courses           - Get user's courses
GET  /api/courses/:courseId/modules/:moduleId - Get module content
```

### Events & Calendar
```
GET  /api/events            - Get all events
GET  /api/events/:id        - Get single event
PUT  /api/events/:id/rsvp   - RSVP to event
GET  /api/events/my-events  - Get user's events
```

### Leaderboard & Points
```
GET  /api/leaderboard                - Get leaderboard
GET  /api/leaderboard/points/:userId - Get user points history
GET  /api/leaderboard/points-info    - Get points rules
```

### Admin Functions
```
GET    /api/admin/dashboard     - Admin dashboard stats
GET    /api/admin/users         - Manage users
PUT    /api/admin/users/:id     - Update user
DELETE /api/admin/users/:id     - Delete user
PUT    /api/admin/users/bulk    - Bulk update users
GET    /api/admin/analytics     - Platform analytics
GET    /api/admin/settings      - Get all admin settings
GET    /api/admin/settings/:category - Get settings by category
PUT    /api/admin/settings/:category - Update settings by category
```

### File Uploads
```
POST   /api/upload/avatar       - Upload avatar image
POST   /api/upload/post-images  - Upload post images
DELETE /api/upload/:publicId    - Delete image
```

## 🗄️ Database Schema

### User Model
- Personal information (name, email, username)
- Authentication (password, JWT tokens)
- Profile data (avatar, bio, location, skills)
- Progress tracking (phase, points, level, courses)
- Activity data (online status, last active)

### Post Model
- Content and categorization
- Author information and timestamps
- Engagement data (likes, comments, views)
- Moderation fields (approval status)

### Course Model
- Course metadata and content structure
- Multi-module organization
- Progress tracking and enrollment
- Instructor information and ratings

### Event Model
- Event details and scheduling
- RSVP and attendance tracking
- Integration with calendar systems
- Feedback and rating collection

### Resource Model
- Resource directory with categories
- Contact information and eligibility
- User reviews and ratings
- Admin approval workflow

### Message & Conversation Models
- Direct messaging between users
- Conversation management
- Read receipts and typing indicators
- Message editing and deletion

### Connection Model
- Three types of connections (Brotherhood, Mentorship, Accountability)
- Request/response workflow
- Connection templates and custom messages
- Connection management and blocking

### Report & Moderation Models
- Content reporting system
- Automated content filtering
- Moderator action tracking
- User warning and suspension system

## 🎯 Point System

Users earn points through various activities:

| Activity | Points | Description |
|----------|--------|-------------|
| Daily Login | 2 | Log in each day |
| Create Post | 5 | Share content |
| Comment | 3 | Engage with posts |
| Complete Module | 10 | Finish course module |
| Complete Course | 50 | Finish entire course |
| Attend Event | 15 | Participate in events |
| Share Win | 20 | Share personal victory |
| Complete Challenge | 25 | Weekly/monthly challenges |
| Daily Challenge Task | 5 | Complete daily challenge task |
| Badge Earned | 20 | Earn achievement badge |
| Help Another Member | 15 | Assist community members |
| Share Resource | 10 | Submit valuable resource |
| Attend Bonus Session | 20 | Join exclusive Q&A sessions |

### Level System
- **New Member** (0-99 pts)
- **Builder** (100-249 pts) 
- **Overcomer** (250-499 pts)
- **Mentor-in-Training** (500-749 pts)
- **Legacy Leader** (750+ pts)

## 🔧 Development

### Available Scripts
```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm run seed       # Seed database with sample data
npm test           # Run tests
```

## 🛡️ Content Moderation Features

### Automated Filtering
- **Profanity Detection**: Automatically filters inappropriate language
- **Hate Speech Detection**: Identifies and flags harmful content
- **Spam Prevention**: Blocks repetitive and promotional content
- **Content Analysis**: Evaluates message sentiment and appropriateness

### Reporting System
- **User Reports**: Members can report inappropriate content
- **Admin Dashboard**: Centralized moderation interface
- **Action Tracking**: Complete audit trail of moderation actions
- **Bulk Operations**: Efficient handling of multiple reports

### User Management
- **Warning System**: Progressive discipline for violations
- **Suspension Management**: Temporary account restrictions
- **Ban System**: Permanent account termination for severe violations
- **Appeal Process**: Framework for reviewing moderation decisions

## 📋 Resource Directory

### Available Categories
- **Housing**: Transitional housing, apartments, emergency shelter
- **Employment**: Job boards, training programs, background-friendly employers
- **Legal Aid**: Expungement services, legal representation, rights advocacy
- **Mental Health**: Counseling, support groups, crisis intervention
- **Financial Services**: Banking, credit repair, financial planning
- **Education**: GED programs, college courses, vocational training
- **Healthcare**: Clinics, insurance programs, medical assistance
- **Transportation**: Public transit, vehicle programs, license restoration
- **Food Assistance**: Food banks, SNAP programs, meal services
- **Childcare**: Daycare services, after-school programs, parenting support
- **Substance Abuse**: Treatment centers, recovery programs, support groups
- **Emergency Services**: Crisis hotlines, emergency financial assistance
- **Technology**: Digital literacy, computer access, internet services

### Resource Features
- **Location-based filtering** (National, Regional, Local, Online)
- **Phase-specific access** controls
- **User reviews and ratings**
- **Admin verification** system
- **Contact information** and eligibility requirements

## 🤝 Connection System

### Connection Types
1. **Brotherhood Connection**
   - General community support and friendship
   - Mutual encouragement and shared experiences
   - Building long-term relationships within the community

2. **Mentorship & Guidance**
   - Learning from members with more experience
   - Phase-specific guidance and advice
   - Career and personal development support

3. **Accountability Partner**
   - Mutual goal tracking and motivation
   - Regular check-ins and progress updates
   - Shared challenges and milestone celebrations

### Connection Features
- **Template messages** for each connection type
- **Custom message** option for personalization
- **Connection management** (accept, decline, block)
- **Connection statistics** and insights
- **Integration with messaging** system

### Project Structure
```
server/
├── src/
│   ├── controllers/    # Route handlers and business logic
│   ├── middleware/     # Authentication, validation, error handling
│   ├── models/         # MongoDB schemas and models
│   ├── routes/         # API route definitions
│   ├── utils/          # Helper functions and utilities
│   ├── config/         # Configuration files
│   └── data/           # Database seeding scripts
├── package.json
├── server.js           # Main application entry point
└── .env.example        # Environment variables template
```

## 🚀 Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production MongoDB URI
3. Set up Cloudinary for image uploads
4. Configure email service for notifications
5. Set strong JWT secrets

### Production Considerations
- Use MongoDB Atlas or similar managed database
- Set up proper logging and monitoring
- Configure SSL/HTTPS
- Set up automated backups
- Implement proper error tracking

### Admin Features Required
- User management and moderation
- Content moderation and approval
- Category and permissions management
- Analytics and metrics
- Event creation and management
- Course content management
- System settings and configuration
- Resource directory management
- Connection oversight and monitoring
- Advanced moderation tools and reporting
- Comprehensive admin settings and customization
- Community guidelines and rule enforcement

## 🧪 Testing

Run the test suite:
```bash
npm test
```

For development testing with seeded data:
```bash
npm run seed  # Create sample data
npm run dev   # Start development server
```

**Test Admin Account:**
- Email: `admin@youyesyou.com`
- Password: `Admin123!`

## 🔐 Security

This API implements multiple layers of security:

- **Authentication**: JWT tokens with configurable expiration
- **Authorization**: Role-based access control (user/admin)
- **Rate Limiting**: Prevents abuse and DDoS attacks
- **Input Validation**: Comprehensive validation for all inputs
- **Password Security**: Bcrypt hashing with salt rounds
- **CORS Protection**: Configurable cross-origin requests
- **Security Headers**: Helmet.js for additional protection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the API documentation

---

**Mission Statement**: "A Brotherhood. A Blueprint. A Second Chance That Leads to Your Best Life."

Built with ❤️ for the YOU YES YOU Community