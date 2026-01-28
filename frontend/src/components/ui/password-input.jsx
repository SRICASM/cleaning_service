import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Lock, Check, X } from "lucide-react";

/**
 * Calculate password strength
 * @returns {Object} { score: 0-4, label: string, color: string }
 */
function getPasswordStrength(password) {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;

  // Length check
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;

  // Contains uppercase
  if (/[A-Z]/.test(password)) score++;

  // Contains number
  if (/[0-9]/.test(password)) score++;

  // Contains special character
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Normalize to 0-4
  score = Math.min(4, score);

  const levels = [
    { label: "", color: "" },
    { label: "Weak", color: "bg-red-500" },
    { label: "Fair", color: "bg-orange-500" },
    { label: "Good", color: "bg-yellow-500" },
    { label: "Strong", color: "bg-green-500" },
  ];

  return { score, ...levels[score] };
}

/**
 * Password requirements checker
 */
function getPasswordRequirements(password) {
  return [
    { label: "At least 6 characters", met: password.length >= 6 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Contains number", met: /[0-9]/.test(password) },
    { label: "Contains special character", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

/**
 * Password input with visibility toggle and optional strength indicator
 *
 * @param {Object} props
 * @param {boolean} props.showStrength - Show strength indicator
 * @param {boolean} props.showRequirements - Show requirements checklist
 * @param {string} props.className - Additional classes for the input wrapper
 */
const PasswordInput = React.forwardRef(
  (
    {
      showStrength = false,
      showRequirements = false,
      className,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const strength = getPasswordStrength(value || "");
    const requirements = getPasswordRequirements(value || "");

    return (
      <div className="space-y-2">
        <div className={cn("relative", className)}>
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 pointer-events-none" />
          <Input
            ref={ref}
            type={showPassword ? "text" : "password"}
            value={value}
            onChange={onChange}
            className="pl-10 pr-10"
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Strength indicator */}
        {showStrength && value && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    level <= strength.score ? strength.color : "bg-stone-200"
                  )}
                />
              ))}
            </div>
            {strength.label && (
              <p
                className={cn(
                  "text-xs font-medium",
                  strength.score <= 1 && "text-red-600",
                  strength.score === 2 && "text-orange-600",
                  strength.score === 3 && "text-yellow-600",
                  strength.score === 4 && "text-green-600"
                )}
              >
                Password strength: {strength.label}
              </p>
            )}
          </div>
        )}

        {/* Requirements checklist */}
        {showRequirements && value && (
          <ul className="space-y-1">
            {requirements.map((req, index) => (
              <li
                key={index}
                className={cn(
                  "flex items-center gap-2 text-xs transition-colors",
                  req.met ? "text-green-600" : "text-stone-400"
                )}
              >
                {req.met ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <X className="w-3 h-3" />
                )}
                {req.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput, getPasswordStrength, getPasswordRequirements };
