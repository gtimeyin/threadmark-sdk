import React from 'react';
import { createRoot } from 'react-dom/client';
import { Threadmark } from '../../src/Threadmark.jsx';
const transport = { connect(scope, onMembers) {
  window.deliver = onMembers; window.publications = []; window.connections = (window.connections || 0) + 1;
  return { publish(cursor) { window.publications.push(cursor); }, close() { onMembers([]); } };
} };
createRoot(document.getElementById('root')).render(<Threadmark projectKey="test" reviewer={{ id: 'you', displayName: 'You' }} buildId="one" route="/" presence={transport} />);
