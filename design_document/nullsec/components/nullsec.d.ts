/** Nullsec — window.Nullsec */
type Tone = "red" | "cyan" | "amber" | "neutral";
type IconName = "close" | "check" | "plus" | "minus" | "arrow-right" | "arrow-left" | "chevron-right" | "chevrons-right" | "chevron-down" | "menu" | "warning" | "lock" | "unlock" | "search" | "settings" | "user" | "power" | "signal" | "target" | "globe" | "cube" | "chip" | "battery" | "mail" | "heart" | "eye" | "terminal" | "download" | "play" | "pause" | "stop";
export interface FrameProps { title?: string; code?: string; tone?: Tone; variant?: "chamfer" | "notched"; striped?: boolean; footer?: React.ReactNode; children?: React.ReactNode; }
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: "solid" | "outline" | "ghost"; tone?: Tone; size?: "sm" | "md" | "lg"; icon?: IconName; trailing?: IconName | false; }
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: IconName; label: string; tone?: Tone; size?: "sm" | "md" | "lg"; variant?: "outline" | "solid"; }
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; icon?: IconName; hint?: string; error?: string; }
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> { label: React.ReactNode; }
export interface MeterProps { label: string; value: number; segments?: number; tone?: Tone; icon?: IconName; display?: string; }
export interface ReadoutProps { label: string; value: React.ReactNode; unit?: string; caption?: string; tone?: Tone; }
export interface StatusTagProps { kind?: "locked" | "unlocked" | "warning" | "online" | "offline"; icon?: IconName; children?: React.ReactNode; }
export interface MenuItem { label: string; disabled?: boolean; }
export interface MenuListProps { items: MenuItem[]; active?: number; onSelect?: (i: number) => void; label?: string; }
export interface TargetProps { label?: string; tone?: Tone; locked?: boolean; children?: React.ReactNode; }
export interface DividerProps { variant?: "ticks" | "stripes"; tone?: Tone; label?: string; }
export interface IconProps { name: IconName; size?: number; label?: string; }
