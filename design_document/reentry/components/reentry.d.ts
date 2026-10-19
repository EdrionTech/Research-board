/** Reentry — window.Reentry */
type Tone = "amber" | "red" | "blue" | "white" | "steel" | "green";
type IconName = "reticle" | "altitude" | "speed" | "thrust" | "fuel" | "shield" | "heat" | "radar" | "signal" | "pod" | "parachute" | "horizon" | "satellite" | "helmet" | "power" | "lock" | "eject" | "warning" | "info" | "check" | "close" | "plus" | "menu" | "settings" | "arrow-right" | "arrow-left" | "chevron-right" | "play";
export interface PlateProps { title?: string; code?: string; stripe?: boolean; footer?: React.ReactNode; children?: React.ReactNode; }
export interface ScreenProps { title?: string; status?: string; alert?: boolean; cursor?: boolean; live?: boolean; children?: React.ReactNode; }
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: "solid" | "ghost"; tone?: Tone; size?: "sm" | "md" | "lg"; icon?: IconName; }
export interface SwitchProps { label: string; checked?: boolean; defaultChecked?: boolean; onChange?: (on: boolean) => void; disabled?: boolean; onText?: string; offText?: string; id?: string; }
export interface GaugeProps { label: string; value: number; min?: number; max?: number; unit?: string; redline?: number; format?: (v: number) => string; size?: number; }
export interface SegmentBarProps { label: string; value: number; segments?: number; warnBelow?: number; tone?: Tone; format?: (v: number) => string; }
export interface TabsProps { tabs: (string | { label: string; icon?: IconName })[]; value?: number; defaultValue?: number; onChange?: (i: number) => void; id?: string; label?: string; children?: React.ReactNode | ((i: number) => React.ReactNode); }
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; icon?: IconName; hint?: string; error?: string; }
export interface SliderProps { label?: string; tone?: Tone; value?: number; defaultValue?: number; min?: number; max?: number; marks?: number; format?: (v: number) => string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; }
export interface HazardProps { tone?: "caution" | "alert"; title?: string; icon?: IconName; live?: boolean; action?: React.ReactNode; children?: React.ReactNode; }
export interface LampProps { color?: "green" | "amber" | "red" | "blue"; state?: "on" | "off" | "blink"; children: React.ReactNode; }
export interface TitleCardProps { title: string; kicker?: string; subtitle?: string; as?: "h1" | "h2" | "h3"; }
export interface IconProps { name: IconName; size?: number; label?: string; }
