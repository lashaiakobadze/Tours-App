/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

const stripe = Stripe(`pk_test_51KSPwCHCmZX8SMhHN23FS4vWvAEys5JZGVibLkyrBTjFxhGRLoDFLJzEKpiBT9NwxkCHP7iO0jSWZBpM1miwKBW000oPdrPxsc`);

export const bookTour = async tourId => {
  try {
    // 1) Get checkout session from API
    const session = await axios(`http://localhost:3000/api/v1/bookings/checkout-session/${tourId}`);

    console.log(session);

    // 2) Create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};