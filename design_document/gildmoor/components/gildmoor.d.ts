/** Gildmoor — window.Gildmoor */
type Gem = "sapphire" | "emerald" | "ruby" | "amethyst" | "midnight" | "gold" | "none";
type IconName = "sword" | "shield" | "potion" | "crown" | "helm" | "scroll" | "book" | "gem" | "key" | "coin" | "heart" | "star" | "moon" | "sun" | "map" | "chest" | "quill" | "flame" | "eye" | "lock" | "settings" | "menu" | "close" | "check" | "plus" | "arrow-right" | "arrow-left" | "chevron-right";
export interface FrameProps { title?: string; shape?: "panel" | "arch" | "banner"; gem?: Gem; footer?: React.ReactNode; children?: React.ReactNode; }
export interface RibbonProps { gem?: Gem; as?: string; children: React.ReactNode; }
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { gem?: Gem; size?: "sm" | "md" | "lg"; icon?: IconName; }
export interface MedallionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: IconName; label: string; gem?: Gem; size?: "sm" | "md" | "lg" | "xl"; }
export interface ItemCardProps { title: string; icon?: IconName; image?: string; gem?: Gem; rarity?: "common" | "rare" | "epic" | "legendary"; footer?: React.ReactNode; children?: React.ReactNode; }
export interface RarityTagProps { rarity: "common" | "rare" | "epic" | "legendary"; children?: React.ReactNode; }
export interface TabsProps { tabs: string[]; value?: number; defaultValue?: number; onChange?: (i: number) => void; id?: string; label?: string; children?: React.ReactNode | ((i: number) => React.ReactNode); }
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; icon?: IconName; hint?: string; error?: string; }
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> { label: React.ReactNode; }
export interface ProgressBarProps { value: number; label?: string; display?: string; gem?: Gem; }
export interface DividerProps { label?: string; }
export interface IconProps { name: IconName; size?: number; label?: string; }
