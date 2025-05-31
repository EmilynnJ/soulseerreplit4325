import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../hooks/use-auth';

function TestComponent() {
  const { user, loginMutation, logoutMutation, registerMutation } = useAuth();

  return (
    <div>
      <div>User: {user ? user.name : 'No user'}</div>
      <button
        onClick={() =>
          loginMutation.mutate({ email: 'test@example.com', password: 'password' })
        }
      >
        Login
      </button>
      <button onClick={() => logoutMutation.mutate()}>Logout</button>
      <button
        onClick={() =>
          registerMutation.mutate({
            email: 'newuser@example.com',
            password: 'password',
            name: 'New User',
          })
        }
      >
        Register
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    // Mock fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should show no user initially', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByText(/No user/i)).toBeInTheDocument();
  });

  test('should login user successfully', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, name: 'Test User', email: 'test@example.com', role: 'client' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, name: 'Test User', email: 'test@example.com', role: 'client' }),
      });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByText(/Test User/i)).toBeInTheDocument();
    });
  });

  test('should register user successfully', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 2, name: 'New User', email: 'newuser@example.com', role: 'client' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 2, name: 'New User', email: 'newuser@example.com', role: 'client' }),
      });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(screen.getByText(/New User/i)).toBeInTheDocument();
    });
  });

  test('should logout user successfully', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, name: 'Test User', email: 'test@example.com', role: 'client' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Login first
    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByText(/Test User/i)).toBeInTheDocument();
    });

    // Logout
    fireEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByText(/No user/i)).toBeInTheDocument();
    });
  });
});
