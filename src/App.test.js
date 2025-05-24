import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the main application title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Office Seat Utilization Simulator/i);
  expect(titleElement).toBeInTheDocument();
});
