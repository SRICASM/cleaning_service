import { Check } from 'lucide-react';

export const Stepper = ({ steps, currentStep }) => {
    return (
        <div className="flex items-center justify-between w-full relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-stone-200 -z-10" />

            {steps.map((step, index) => {
                const isCompleted = currentStep > step.number;
                const isCurrent = currentStep === step.number;

                return (
                    <div key={step.number} className="flex flex-col items-center bg-white px-2">
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isCompleted
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : isCurrent
                                        ? 'bg-white border-emerald-500 text-emerald-600 scale-110'
                                        : 'bg-white border-stone-300 text-stone-300'
                                }`}
                        >
                            {isCompleted ? (
                                <Check className="w-5 h-5" />
                            ) : (
                                <step.icon className={`w-5 h-5 ${isCurrent ? 'animate-pulse' : ''}`} />
                            )}
                        </div>

                        <div className="mt-2 text-center">
                            <p
                                className={`text-sm font-semibold transition-colors duration-300 ${isCurrent || isCompleted ? 'text-green-900' : 'text-stone-400'
                                    }`}
                            >
                                {step.title}
                            </p>
                            <p className="text-xs text-stone-500 hidden md:block">
                                {step.description}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
