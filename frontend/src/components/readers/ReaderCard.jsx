// c:\Users\emily\soulseerreplit4325-1\frontend\src\components\readers\ReaderCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import placeholderImage from '../../assets/images/placeholder.png'; // Assuming you have a placeholder

const ReaderCard = ({ reader }) => {
  const { id, name, specialties, profileImageUrl, isOnline, ratePerMinute } = reader;

  return (
    <div style={{
      border: '1px solid var(--color-accent-gold)',
      borderRadius: '8px',
      padding: '1rem',
      margin: '1rem',
      width: '250px',
      backgroundColor: 'var(--color-background-light-accent)',
      boxShadow: 'var(--soft-glow-pink)'
    }}>
      <img src={profileImageUrl || placeholderImage} alt={name} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px' }} />
      <h3 style={{ color: 'var(--color-primary-pink)', marginTop: '0.5rem' }}>{name}</h3>
      <p style={{ fontSize: '0.9rem', color: 'var(--color-text-light)' }}>Specialties: {specialties?.join(', ') || 'N/A'}</p>
      <p style={{ color: isOnline ? 'lightgreen' : 'lightcoral' }}>{isOnline ? 'Online' : 'Offline'}</p>
      {ratePerMinute && <p style={{ color: 'var(--color-text-gold)' }}>${ratePerMinute}/min</p>}
      <Link to={`/readers/${id}`} style={{ color: 'var(--color-accent-gold)'}}>View Profile</Link>
    </div>
  );
};

export default ReaderCard;