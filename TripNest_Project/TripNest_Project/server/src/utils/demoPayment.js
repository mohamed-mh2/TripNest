// Simulated payment with preset demo cards. No real card data is collected and no money moves. المسؤول: abed alrahman.

const crypto = require('crypto');


const DEMO_PAYMENT_CARDS = [
  {
    id: 'demo_card_approve',
    label: 'TripNest Demo Visa ending 4242',
    outcome: 'approved',
    description: 'Simulates a successful payment.',
  },
  {
    id: 'demo_card_decline',
    label: 'TripNest Demo Visa ending 0002',
    outcome: 'declined',
    description: 'Simulates a declined payment. No booking is created.',
  },
];


function findDemoCard(cardId) {
  return DEMO_PAYMENT_CARDS.find((card) => card.id === cardId) || null;
}


function randomCode(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let index = 0; index < length; index += 1) {
    code += alphabet[crypto.randomInt(alphabet.length)];
  }

  return code;
}


// #explain_notes: The outcome depends only on which preset demo card was chosen.
function simulatePayment(card) {
  if (card.outcome === 'approved') {
    return {
      approved: true,
      paymentReference: `DEMO-PAY-${randomCode(10)}`,
    };
  }

  return {
    approved: false,
    declineReason: 'The demo card was declined (simulation). No booking was created and nothing was charged.',
  };
}


function createBookingReference() {
  return `TN-${randomCode(8)}`;
}


module.exports = {
  DEMO_PAYMENT_CARDS,
  findDemoCard,
  simulatePayment,
  createBookingReference,
};
