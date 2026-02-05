const FAQAccordion = ({ items, defaultOpen = 0 }) => {
  const [openIndex, setOpenIndex] = useState(defaultOpen);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div
          key={index}
          className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${openIndex === index ? 'border-emerald-500/30 shadow-md ring-1 ring-emerald-500/20' : 'border-stone-100 shadow-sm hover:border-stone-200'
            }`}
        >
          <button
            onClick={() => toggle(index)}
            className="w-full flex items-center justify-between p-5 text-left transition-colors"
          >
            <span className={`font-semibold text-lg pr-4 transition-colors ${openIndex === index ? 'text-emerald-700' : 'text-green-950'
              }`}>{item.question}</span>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${openIndex === index ? 'bg-emerald-100 rotate-180' : 'bg-stone-50'
              }`}>
              <ChevronDown
                className={`w-5 h-5 transition-colors ${openIndex === index ? 'text-emerald-600' : 'text-stone-400'
                  }`}
              />
            </div>
          </button>
          <div
            className={`grid transition-all duration-300 ease-in-out ${openIndex === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
          >
            <div className="overflow-hidden">
              <div className="px-5 pb-5 pt-0 text-stone-600 leading-relaxed">
                {item.answer}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const FAQSection = ({ title = 'Frequently Asked Questions', faqs }) => {
  return (
    <section className="py-20 bg-stone-50 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <div className="max-w-3xl mx-auto px-6 lg:px-8 relative z-10">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-green-950 text-center mb-12">
          {title}
        </h2>
        <FAQAccordion items={faqs} />
      </div>
    </section>
  );
};

export { FAQAccordion, FAQSection };
