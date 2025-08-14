import sgMail from '@sendgrid/mail';

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Send welcome email
export const sendWelcomeEmail = async (user) => {
  try {

    const msg = {
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: 'Welcome to YOU YES YOU Community! 🎉',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to YOU YES YOU!</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">A Brotherhood. A Blueprint. A Second Chance That Leads to Your Best Life.</p>
          </div>
          
          <div style="padding: 40px 20px; background: #f8f9fa;">
            <h2 style="color: #333; margin-top: 0;">Hello ${user.name}! 👋</h2>
            
            <p style="color: #666; line-height: 1.6;">
              We're thrilled to have you join our community of formerly incarcerated fathers who are committed to transformation, growth, and building better lives for their families.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Here's what you can do next:</h3>
              <ul style="color: #666; line-height: 1.8;">
                <li>Complete your profile and tell us about yourself</li>
                <li>Start with the "Foundations of Personal Growth" course</li>
                <li>Introduce yourself in the General Discussion</li>
                <li>Join our upcoming events and Q&A sessions</li>
                <li>Connect with other members in your phase</li>
              </ul>
            </div>
            
            <p style="color: #666; line-height: 1.6;">
              Remember, this journey is about progress, not perfection. Every step forward matters, and you don't have to walk this path alone.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                 style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Access Your Dashboard
              </a>
            </div>
            
            <p style="color: #888; font-size: 14px; text-align: center; margin-top: 40px;">
              Questions? Reply to this email or reach out to our community team.
            </p>
          </div>
        </div>
      `,
    };

    await sgMail.send(msg);
    console.log(`✅ Welcome email sent to ${user.email}`);
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (user, resetToken) => {
  try {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const msg = {
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: 'Password Reset Request - YOU YES YOU',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: #667eea; padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Password Reset</h1>
          </div>
          
          <div style="padding: 40px 20px;">
            <h2 style="color: #333;">Hello ${user.name},</h2>
            
            <p style="color: #666; line-height: 1.6;">
              You requested a password reset for your YOU YES YOU account. Click the button below to reset your password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
            </p>
            
            <p style="color: #888; font-size: 12px; margin-top: 40px;">
              If the button doesn't work, copy and paste this link: ${resetUrl}
            </p>
          </div>
        </div>
      `,
    };

    await sgMail.send(msg);
    console.log(`✅ Password reset email sent to ${user.email}`);
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
  }
};

// Send event reminder email
export const sendEventReminderEmail = async (user, event) => {
  try {

    const msg = {
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: `Reminder: ${event.title} - Tomorrow!`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: #667eea; padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Event Reminder</h1>
          </div>
          
          <div style="padding: 40px 20px;">
            <h2 style="color: #333;">Don't forget: ${event.title}</h2>
            
            <p style="color: #666; line-height: 1.6;">
              Hi ${user.name}, this is a friendly reminder that you're registered for our upcoming event:
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">${event.title}</h3>
              <p style="color: #666; margin: 5px 0;"><strong>Date:</strong> ${event.date.toLocaleDateString()}</p>
              <p style="color: #666; margin: 5px 0;"><strong>Time:</strong> ${event.date.toLocaleTimeString()}</p>
              <p style="color: #666; margin: 5px 0;"><strong>Duration:</strong> ${event.duration}</p>
              <p style="color: #666; margin: 5px 0;"><strong>Instructor:</strong> ${event.instructor}</p>
            </div>
            
            ${event.zoomLink ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${event.zoomLink}" 
                   style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Join Event
                </a>
              </div>
            ` : ''}
            
            <p style="color: #666; line-height: 1.6;">
              We're looking forward to seeing you there! Come prepared to learn, share, and connect with your brothers in the community.
            </p>
          </div>
        </div>
      `,
    };

    await sgMail.send(msg);
    console.log(`✅ Event reminder sent to ${user.email}`);
  } catch (error) {
    console.error('❌ Failed to send event reminder:', error);
  }
};

// Send auto-welcome DM to new members
export const sendAutoWelcomeDM = async (user) => {
  try {
    const msg = {
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: 'Your Journey Begins Now - YOU YES YOU',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome, ${user.name}! 👋</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Your transformation journey starts here</p>
          </div>
          
          <div style="padding: 40px 20px; background: #f8f9fa;">
            <h2 style="color: #333; margin-top: 0;">Here's how to get started:</h2>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <ol style="color: #666; line-height: 1.8;">
                <li><strong>Complete your profile</strong> - Tell us about yourself and your journey</li>
                <li><strong>Start the onboarding course</strong> - "Foundations of Personal Growth"</li>
                <li><strong>Introduce yourself</strong> - Make your first post in General Discussion</li>
                <li><strong>Connect with others</strong> - Send connection requests to fellow members</li>
                <li><strong>Join upcoming events</strong> - Check the calendar for live sessions</li>
              </ol>
            </div>
            
            <div style="background: #667eea; color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: white;">🎯 Your First Week Goals:</h3>
              <ul style="line-height: 1.6;">
                <li>Complete your profile (15 points)</li>
                <li>Make your first post (10 points)</li>
                <li>Comment on 3 posts (15 points)</li>
                <li>RSVP to an event (5 points)</li>
                <li>Login daily for 7 days (14 points + streak bonus)</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                 style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Start Your Journey
              </a>
            </div>
          </div>
        </div>
      `,
    };

    await sgMail.send(msg);
    console.log(`✅ Auto-welcome DM sent to ${user.email}`);
  } catch (error) {
    console.error('❌ Failed to send auto-welcome DM:', error);
  }
};

// Send badge earned notification
export const sendBadgeEarnedEmail = async (user, badge) => {
  try {
    const msg = {
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: `🏅 You Earned a Badge: ${badge.name}!`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: #667eea; padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Congratulations! 🎉</h1>
          </div>
          
          <div style="padding: 40px 20px; text-align: center;">
            <div style="font-size: 48px; margin: 20px 0;">${badge.icon}</div>
            <h2 style="color: #333;">${badge.name}</h2>
            <p style="color: #666; font-size: 18px;">${badge.description}</p>
            
            ${badge.rewards.points > 0 ? `
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #333; margin: 0;"><strong>Bonus: +${badge.rewards.points} points awarded!</strong></p>
              </div>
            ` : ''}
            
            <p style="color: #666;">Keep up the amazing work! Your growth inspires the entire community.</p>
          </div>
        </div>
      `,
    };

    await sgMail.send(msg);
    console.log(`✅ Badge earned email sent to ${user.email}`);
  } catch (error) {
    console.error('❌ Failed to send badge earned email:', error);
  }
};

// Send course completion email
export const sendCourseCompletionMessage = async (user, course) => {
  try {
    const msg = {
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: `🎓 Course Completed: ${course.title}!`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: #667eea; padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Congratulations! 🎉</h1>
          </div>
          
          <div style="padding: 40px 20px;">
            <h2 style="color: #333;">You completed ${course.title}!</h2>
            
            <p style="color: #666; line-height: 1.6;">
              This achievement shows your commitment to growth and your investment in yourself. You earned +50 points and a digital certificate.
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">What's next?</h3>
              <ul style="color: #666; line-height: 1.6;">
                <li>Share your biggest takeaway in the Wins section</li>
                <li>Apply what you learned in your daily life</li>
                <li>Help other members taking this course</li>
                <li>Consider starting the next course in your phase</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/courses" 
                 style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Continue Learning
              </a>
            </div>
          </div>
        </div>
      `,
    };

    await sgMail.send(msg);
    console.log(`✅ Course completion email sent to ${user.email}`);
  } catch (error) {
    console.error('❌ Failed to send course completion email:', error);
  }
};

export default {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEventReminderEmail,
  sendAutoWelcomeDM,
  sendBadgeEarnedEmail,
  sendCourseCompletionMessage,
};