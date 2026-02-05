import { useState, useEffect } from 'react';
import { Star, ThumbsUp, ChevronDown, Filter } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StarRating = ({ rating, size = 'default' }) => {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= rating
              ? 'text-amber-400 fill-amber-400'
              : 'text-stone-200'
          }`}
        />
      ))}
    </div>
  );
};

const RatingBreakdown = ({ breakdown }) => {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((rating) => {
        const count = breakdown[rating] || 0;
        const percentage = total > 0 ? (count / total) * 100 : 0;

        return (
          <div key={rating} className="flex items-center gap-2 text-sm">
            <span className="w-3 text-stone-600">{rating}</span>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="w-10 text-stone-500 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
};

const ReviewCard = ({ review }) => {
  const [isHelpful, setIsHelpful] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
            <span className="font-semibold text-emerald-700">
              {review.customer_name?.charAt(0) || 'A'}
            </span>
          </div>
          <div>
            <p className="font-medium text-green-900">{review.customer_name || 'Anonymous'}</p>
            <p className="text-xs text-stone-500">
              {new Date(review.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>
        <StarRating rating={review.overall_rating} size="sm" />
      </div>

      {review.comment && (
        <p className="text-stone-600 mb-3">{review.comment}</p>
      )}

      {review.service_name && (
        <span className="inline-block px-3 py-1 bg-stone-100 text-stone-600 text-xs rounded-full mb-3">
          {review.service_name}
        </span>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-stone-100">
        <button
          onClick={() => setIsHelpful(!isHelpful)}
          className={`flex items-center gap-1 text-sm ${
            isHelpful ? 'text-emerald-600' : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <ThumbsUp className="w-4 h-4" />
          Helpful
        </button>
        {review.is_verified && (
          <span className="text-xs text-emerald-600 font-medium">Verified Purchase</span>
        )}
      </div>
    </div>
  );
};

const ReviewsSection = ({
  serviceId = null,
  title = 'Customer Reviews',
  showBreakdown = true,
  limit = 6
}) => {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ average: 0, total: 0, breakdown: {} });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [serviceId, filter]);

  const fetchReviews = async () => {
    try {
      const params = new URLSearchParams();
      if (serviceId) params.append('service_id', serviceId);
      if (filter !== 'all') params.append('rating', filter);
      params.append('limit', limit.toString());

      const response = await axios.get(`${API}/reviews?${params.toString()}`);
      setReviews(response.data.reviews || response.data || []);

      // Calculate stats
      const allReviews = response.data.reviews || response.data || [];
      const total = allReviews.length;
      const average = total > 0
        ? allReviews.reduce((sum, r) => sum + r.overall_rating, 0) / total
        : 0;

      const breakdown = {};
      allReviews.forEach(r => {
        breakdown[r.overall_rating] = (breakdown[r.overall_rating] || 0) + 1;
      });

      setStats({ average, total, breakdown });
    } catch (error) {
      console.log('Error fetching reviews:', error);
      // Use mock data for demo
      setReviews([
        {
          id: 1,
          customer_name: 'Sarah M.',
          overall_rating: 5,
          comment: 'Excellent service! The cleaner was thorough and professional. My apartment has never looked better.',
          created_at: new Date().toISOString(),
          service_name: 'Deep Cleaning',
          is_verified: true
        },
        {
          id: 2,
          customer_name: 'Ahmed K.',
          overall_rating: 5,
          comment: 'Very impressed with the attention to detail. Will definitely book again!',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          service_name: 'Regular Cleaning',
          is_verified: true
        },
        {
          id: 3,
          customer_name: 'Maria L.',
          overall_rating: 4,
          comment: 'Good service overall. Arrived on time and did a thorough job.',
          created_at: new Date(Date.now() - 172800000).toISOString(),
          service_name: 'Move-Out Cleaning',
          is_verified: true
        }
      ]);
      setStats({
        average: 4.8,
        total: 1247,
        breakdown: { 5: 892, 4: 268, 3: 62, 2: 18, 1: 7 }
      });
    } finally {
      setLoading(false);
    }
  };

  const displayedReviews = showMore ? reviews : reviews.slice(0, 3);

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <h2 className="text-2xl lg:text-3xl font-bold text-green-900 mb-8">{title}</h2>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Stats Sidebar */}
          {showBreakdown && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-stone-200 p-6 sticky top-24">
                <div className="text-center mb-6">
                  <p className="text-4xl font-bold text-green-900">{stats.average.toFixed(1)}</p>
                  <StarRating rating={Math.round(stats.average)} size="lg" />
                  <p className="text-sm text-stone-500 mt-2">
                    Based on {stats.total.toLocaleString()} reviews
                  </p>
                </div>

                <RatingBreakdown breakdown={stats.breakdown} />

                {/* Filter */}
                <div className="mt-6 pt-6 border-t border-stone-200">
                  <p className="text-sm font-medium text-stone-700 mb-2">Filter by rating</p>
                  <div className="flex flex-wrap gap-2">
                    {['all', 5, 4, 3].map((value) => (
                      <button
                        key={value}
                        onClick={() => setFilter(value)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          filter === value
                            ? 'bg-emerald-500 text-white'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {value === 'all' ? 'All' : `${value} Stars`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reviews Grid */}
          <div className={showBreakdown ? 'lg:col-span-3' : 'lg:col-span-4'}>
            {loading ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-stone-200 rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-stone-200 rounded w-24 mb-1" />
                        <div className="h-3 bg-stone-200 rounded w-16" />
                      </div>
                    </div>
                    <div className="h-4 bg-stone-200 rounded w-full mb-2" />
                    <div className="h-4 bg-stone-200 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  {displayedReviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>

                {reviews.length > 3 && (
                  <div className="text-center mt-6">
                    <button
                      onClick={() => setShowMore(!showMore)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-stone-200 rounded-full text-green-900 font-medium hover:bg-stone-50 transition-colors"
                    >
                      {showMore ? 'Show Less' : `Show All ${reviews.length} Reviews`}
                      <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
