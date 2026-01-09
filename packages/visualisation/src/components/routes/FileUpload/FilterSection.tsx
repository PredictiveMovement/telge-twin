import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'

interface FilterSectionProps {
  label: string
  items: string[]
  selectedItems?: string[]
  onToggle: (filterType: string, value: string) => void
  filterType: string
}

export function FilterSection({
  label,
  items,
  selectedItems,
  onToggle,
  filterType,
}: FilterSectionProps) {
  return (
    <div>
      <Label>
        {label} ({items.length || 0})
      </Label>
      <div className="flex flex-wrap gap-2 mt-2">
        {items.map((item) => (
          <Badge
            key={item}
            variant={selectedItems?.includes(item) ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => onToggle(filterType, item)}
          >
            {item}
          </Badge>
        ))}
      </div>
    </div>
  )
}
