/**
 * Firebase Cloud Function to send emails via SendGrid
 * 
 * To deploy this function:
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Login: firebase login
 * 3. Initialize functions: firebase init functions
 * 4. Install dependencies: cd functions && npm install @sendgrid/mail
 * 5. Set SendGrid API Key: firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY"
 * 6. Deploy: firebase deploy --only functions
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as sgMail from '@sendgrid/mail';

admin.initializeApp();

// Get SendGrid API Key - Using the provided key directly as requested for activation
const SENDGRID_API_KEY = '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';
sgMail.setApiKey(SENDGRID_API_KEY);

console.log('Cloud Function: Listening for new documents in "mail" collection...');

export const sendEmailOnMailWrite = functions.firestore
  .document('mail/{mailId}')
  .onCreate(async (snap, context) => {
    const mailData = snap.data();
    
    if (!mailData) {
      console.error('No mail data found');
      return;
    }

    const msg = {
      to: mailData.to,
      from: 'noreply@tus-metas.com', // Replace with your verified SendGrid sender
      subject: mailData.message.subject,
      text: mailData.message.text,
      html: mailData.message.html || mailData.message.text,
    };

    try {
      await sgMail.send(msg);
      console.log(`Email sent to ${mailData.to}`);
      
      // Optionally mark as sent or delete the document
      // await snap.ref.update({ sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (error) {
      console.error('Error sending email:', error);
      if (error.response) {
        console.error(error.response.body);
      }
    }
  });
