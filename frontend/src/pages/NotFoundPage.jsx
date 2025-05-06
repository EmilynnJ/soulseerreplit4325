// c:\Users\emily\soulseerreplit4325-1\frontend\src\pages\NotFoundPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div>
      <h1>404 - Page Not Found</h1>
      <p>Oops! The page you are looking for does not exist. <Link to="/">Go Home</Link></p>
    </div>
  );
};

export default NotFoundPage;