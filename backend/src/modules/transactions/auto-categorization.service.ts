import { Injectable } from '@nestjs/common';

/**
 * Simple rule-based auto-categorization service.
 * This is a lightweight starting point that can be replaced by an ML model later.
 */
@Injectable()
export class AutoCategorizationService {
  private keywordMap: Record<string, string> = {
    grocery: 'Groceries',
    supermarket: 'Groceries',
    starbucks: 'Dining',
    restaurant: 'Dining',
    uber: 'Transport',
    lyft: 'Transport',
    rent: 'Rent',
    salary: 'Income',
    paycheck: 'Income',
    amazon: 'Shopping',
  };

  predictCategory(metadata: Record<string, any> | undefined): string | null {
    if (!metadata) return null;

    // Look into common fields
    const searchable: string[] = [];

    if (typeof metadata.description === 'string')
      searchable.push(metadata.description);

    if (typeof metadata.memo === 'string') searchable.push(metadata.memo);

    if (typeof metadata.counterparty === 'string')
      searchable.push(metadata.counterparty);

    // Include merchant/name fields in metadata
    if (metadata?.merchant && typeof metadata.merchant === 'string') {
      searchable.push(metadata.merchant);
    }

    const haystack = searchable.join(' ').toLowerCase();

    for (const key of Object.keys(this.keywordMap)) {
      if (haystack.includes(key)) {
        return this.keywordMap[key];
      }
    }

    return null;
  }
}
