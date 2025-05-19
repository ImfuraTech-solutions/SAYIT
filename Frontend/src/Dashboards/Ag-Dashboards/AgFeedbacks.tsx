import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Feedback {
  _id: string;
  complaintId: string;
  citizenName: string;
  message: string;
  rating: number;
  createdAt: string;
}

const AgFeedbacks: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedbacks = async () => {
      try {
        const res = await axios.get('/api/feedback');
        setFeedbacks(res.data);
      } catch (err) {
        // handle error
      } finally {
        setLoading(false);
      }
    };
    fetchFeedbacks();
  }, []);

  if (loading) return <div>Loading feedbacks...</div>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Citizen Feedbacks</h2>
      {feedbacks.length === 0 ? (
        <div>No feedbacks found.</div>
      ) : (
        <ul className="space-y-4">
          {feedbacks.map(fb => (
            <li key={fb._id} className="p-4 bg-white rounded shadow">
              <div className="flex justify-between">
                <span className="font-semibold">{fb.citizenName}</span>
                <span className="text-sm text-gray-500">{new Date(fb.createdAt).toLocaleString()}</span>
              </div>
              <div className="mt-2 text-yellow-500">Rating: {fb.rating}/5</div>
              <div className="mt-2">{fb.message}</div>
              <div className="mt-2 text-xs text-gray-400">Complaint ID: {fb.complaintId}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AgFeedbacks;