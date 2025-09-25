import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { feedbackService, FeedbackData } from '../../services/feedbackService';

interface FeedbackButtonProps {
  className?: string;
}

const FeedbackButton: React.FC<FeedbackButtonProps> = ({ className = '' }) => {
  const location = useLocation();
  const { user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleQuickFeedback = async (rating: number) => {
    setSelectedRating(rating);
    setIsModalOpen(true);
  };

  const handleSubmitFeedback = async () => {
    if (selectedRating === null) return;

    setIsSubmitting(true);
    try {
      const feedbackData: FeedbackData = {
        score: selectedRating,
        comment: comment.trim() || undefined,
        page: location.pathname,
        country: user?.country || undefined,
        user_id: user?.id || undefined
      };

      console.log('Submitting feedback with data:', feedbackData);
      await feedbackService.submitFeedback(feedbackData);
      
      setShowSuccess(true);
      setIsModalOpen(false);
      setComment('');
      setSelectedRating(null);
      
      // Hide success message after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setComment('');
    setSelectedRating(null);
  };

  return (
    <>
      {/* Feedback Button */}
      <div className={`fixed top-16 right-6 z-40 ${className}`}>
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
          <div className="text-sm text-gray-600 mb-2 text-center">How was your experience?</div>
          <div className="flex gap-2">
            <button
              onClick={() => handleQuickFeedback(9)}
              className="flex items-center justify-center w-12 h-12 bg-green-100 hover:bg-green-200 text-green-greenMain rounded-lg transition-colors"
              title="Good experience (9/10)"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z"/>
              </svg>
            </button>
            <button
              onClick={() => handleQuickFeedback(3)}
              className="flex items-center justify-center w-12 h-12 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
              title="Poor experience (3/10)"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.73 5.25h1.035A7.465 7.465 0 0118 9.375a7.465 7.465 0 01-1.235 4.125h-.148c-.806 0-1.534.446-2.031 1.08a9.04 9.04 0 01-2.861 2.4c-.723.384-1.35.956-1.653 1.715a4.498 4.498 0 00-.322 1.672V21a.75.75 0 01-.75.75 2.25 2.25 0 01-2.25-2.25c0-1.152.26-2.243.723-3.218C7.74 15.724 7.366 15 6.748 15H3.622c-1.026 0-1.945-.694-2.054-1.715A12.134 12.134 0 011.5 12c0-2.848.992-5.464 2.649-7.521C4.537 3.997 5.136 3.75 5.754 3.75h4.016c.483 0 .964.078 1.423.23l3.114 1.04a4.5 4.5 0 001.423.23zM21.669 13.023c.536-1.362.831-2.845.831-4.398 0-1.22-.182-2.398-.52-3.507-.26-.85-1.084-1.368-1.973-1.368H19.1c-.445 0-.72.498-.523.898.591 1.2.924 2.55.924 3.977a8.959 8.959 0 01-1.302 4.666c-.245.403.028.959.5.959h1.053c.832 0 1.612-.453 1.918-1.227z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="fixed top-32 right-6 z-40 bg-green-greenMain text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Thank you for your feedback!
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Share Your Feedback
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Rating Display and Selector */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-gray-600">Your rating:</span>
                  <span className="text-sm font-medium text-green-greenMain">{selectedRating}/10</span>
                </div>
                
                {/* Number rating selector */}
                <div className="flex gap-1 mb-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setSelectedRating(rating)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                        selectedRating === rating
                          ? 'bg-green-greenMain text-white'
                          : rating <= (selectedRating || 0)
                          ? 'bg-green-100 text-green-greenMain'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title={`Rate ${rating}/10`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
                
                <div className="text-xs text-gray-500">
                  {selectedRating && selectedRating <= 3 && "Poor experience"}
                  {selectedRating && selectedRating >= 4 && selectedRating <= 6 && "Average experience"}
                  {selectedRating && selectedRating >= 7 && selectedRating <= 8 && "Good experience"}
                  {selectedRating && selectedRating >= 9 && "Excellent experience"}
                </div>
              </div>

              {/* Comment Section */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional comments (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-green-greenMain focus:border-green-greenMain"
                  rows={4}
                  placeholder="Tell us more about your experience..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 btn bg-gray-100 hover:bg-gray-200 text-gray-700"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitFeedback}
                  disabled={isSubmitting}
                  className="flex-1 btn-success disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackButton;
