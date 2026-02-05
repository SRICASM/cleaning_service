import { useState } from 'react';
import { ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react';

const BeforeAfterGallery = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [sliderPosition, setSliderPosition] = useState(50);

  const transformations = [
    {
      id: 1,
      before: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&h=400&fit=crop&sat=-100',
      after: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&h=400&fit=crop',
      service: 'Kitchen Deep Clean',
      location: 'Dubai Marina',
      customer: 'Sarah M.',
      rating: 5,
      review: 'Absolutely spotless! They cleaned areas I didn\'t even know existed.',
    },
    {
      id: 2,
      before: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600&h=400&fit=crop&sat=-100',
      after: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600&h=400&fit=crop',
      service: 'Bathroom Restoration',
      location: 'Downtown Dubai',
      customer: 'Ahmed K.',
      rating: 5,
      review: 'Like a brand new bathroom! The grout looks amazing.',
    },
    {
      id: 3,
      before: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop&sat=-100',
      after: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop',
      service: 'Living Room Deep Clean',
      location: 'JBR',
      customer: 'Priya S.',
      rating: 5,
      review: 'They transformed my living room completely. Highly recommend!',
    },
  ];

  const currentItem = transformations[activeIndex];

  const handleSliderChange = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.min(Math.max(percentage, 0), 100));
  };

  const handleTouchMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.min(Math.max(percentage, 0), 100));
  };

  const nextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % transformations.length);
    setSliderPosition(50);
  };

  const prevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + transformations.length) % transformations.length);
    setSliderPosition(50);
  };

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="badge-premium mb-4">
            <Star className="w-4 h-4" />
            Real Results
          </span>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-green-900 mb-4">
            See the Transformation
          </h2>
          <p className="text-stone-600 max-w-2xl mx-auto">
            Drag the slider to reveal the incredible before and after results from our professional cleaning services.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Before/After Slider */}
          <div className="relative">
            <div
              className="relative aspect-[4/3] rounded-2xl overflow-hidden cursor-ew-resize shadow-premium-lg"
              onMouseMove={handleSliderChange}
              onTouchMove={handleTouchMove}
            >
              {/* After Image (Background) */}
              <img
                src={currentItem.after}
                alt="After cleaning"
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Before Image (Clipped) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${sliderPosition}%` }}
              >
                <img
                  src={currentItem.before}
                  alt="Before cleaning"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ width: `${100 / (sliderPosition / 100)}%`, maxWidth: 'none' }}
                />
              </div>

              {/* Slider Handle */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
                style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                  <div className="flex gap-0.5">
                    <ChevronLeft className="w-4 h-4 text-stone-600" />
                    <ChevronRight className="w-4 h-4 text-stone-600" />
                  </div>
                </div>
              </div>

              {/* Labels */}
              <div className="absolute top-4 left-4 bg-stone-900/80 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                Before
              </div>
              <div className="absolute top-4 right-4 bg-emerald-500/90 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                After
              </div>
            </div>

            {/* Navigation Dots */}
            <div className="flex justify-center gap-2 mt-4">
              {transformations.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setActiveIndex(index);
                    setSliderPosition(50);
                  }}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    index === activeIndex
                      ? 'bg-emerald-500 w-8'
                      : 'bg-stone-300 hover:bg-stone-400'
                  }`}
                />
              ))}
            </div>

            {/* Arrow Navigation */}
            <button
              onClick={prevSlide}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-stone-600" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-stone-600" />
            </button>
          </div>

          {/* Testimonial Card */}
          <div className="bg-gradient-to-br from-stone-50 to-white rounded-2xl p-8 border border-stone-100 shadow-premium">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                {currentItem.service}
              </span>
              <span className="text-stone-400 text-sm">{currentItem.location}</span>
            </div>

            <Quote className="w-10 h-10 text-emerald-100 mb-4" />

            <p className="text-xl text-green-900 font-medium mb-6 leading-relaxed">
              "{currentItem.review}"
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {currentItem.customer.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-green-900">{currentItem.customer}</p>
                  <p className="text-sm text-stone-500">Verified Customer</p>
                </div>
              </div>
              <div className="flex gap-0.5">
                {[...Array(currentItem.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 pt-12 border-t border-stone-200">
          {[
            { number: '10,000+', label: 'Happy Customers' },
            { number: '50,000+', label: 'Homes Cleaned' },
            { number: '4.9', label: 'Average Rating' },
            { number: '98%', label: 'Would Recommend' },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <p className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-lime-500">
                {stat.number}
              </p>
              <p className="text-stone-500 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BeforeAfterGallery;
