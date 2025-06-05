import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CustomerNumberFilterProps {
  customerNumber: string
  onCustomerNumberChange: (value: string) => void
}

const CustomerNumberFilter: React.FC<CustomerNumberFilterProps> = ({
  customerNumber,
  onCustomerNumberChange,
}) => {
  return (
    <div>
      <Label htmlFor="customerNumber">Kundnummer</Label>
      <Input
        id="customerNumber"
        value={customerNumber}
        onChange={(e) => onCustomerNumberChange(e.target.value)}
        placeholder="Filtrera på kundnummer"
      />
    </div>
  )
}

export default CustomerNumberFilter
