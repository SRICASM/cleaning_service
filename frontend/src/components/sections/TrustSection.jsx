import {
  Shield,
  BadgeCheck,
  Clock,
  ThumbsUp,
  Star,
  Users,
  Award,
  Banknote
} from 'lucide-react';

const TrustSection = ({ variant = 'default', showStats = true }) => {
  const trustBadges = [
    {
      icon: BadgeCheck,
      title: 'Verified Professionals',
      description: 'Background-checked & trained cleaners'
    },
    {
      icon: Shield,
      title: 'Fully Insured',
      description: 'Coverage for your peace of mind'
    },
    {
      icon: ThumbsUp,
      title: 'Satisfaction Guaranteed',
      description: "Not happy? We'll re-clean for free"
    },
    {
      icon: Banknote,
      title: 'Transparent Pricing',
      description: 'No hidden fees, ever'
    }
  ];

  const stats = [
    { value: '10K+', label: 'Happy Customers', icon: Users },
    { value: '4.9', label: 'Average Rating', icon: Star },
    { value: '15+', label: 'Years Experience', icon: Award },
    { value: '50K+', label: 'Cleans Completed', icon: Clock },
  ];

  if (variant === 'compact') {
    return (
      <div className="bg-stone-50 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-center gap-6">
          {trustBadges.slice(0, 3).map((badge, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <badge.icon className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-green-900">{badge.title}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-4 py-4">
        {trustBadges.map((badge, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-stone-200 shadow-sm"
          >
            <badge.icon className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium text-green-900">{badge.title}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Stats Row */}
        {showStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <stat.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="text-2xl lg:text-3xl font-bold text-green-900">{stat.value}</p>
                <p className="text-sm text-stone-500">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Trust Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {trustBadges.map((badge, index) => (
            <div
              key={index}
              className="bg-stone-50 rounded-2xl p-6 text-center hover:shadow-md transition-shadow"
            >
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <badge.icon className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-green-900 mb-1">{badge.title}</h3>
              <p className="text-sm text-stone-500">{badge.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
