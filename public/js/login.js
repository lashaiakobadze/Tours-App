/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

export const login = async (email, password) => {
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/login',      
      data: {
        email,
        password
      }      
    });

    // console.log(res.data);
    
    if(res.data.status === 'success') {
      showAlert('success', 'Logged in successfully');
      window.setTimeout(() => {
        location.assign('/')
      }, 1500);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};

export const  logout = async (e) => {
  e.preventDefault();
  try {
    const res = await axios({
      method: 'GET',
      url: '/api/v1/users/logout',
    });

    showAlert('success', 'Log out successfully');
    if(res.data.status === 'success') location.assign('/');

  } catch(err) {    
    console.log(err.response);
    showAlert('error', 'Error logging out! try again');
  }
}