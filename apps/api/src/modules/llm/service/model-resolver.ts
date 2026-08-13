export function resolveModel(model: 'standard'): { providerModel: string } {
  switch (model) {
    case 'standard':
      return { providerModel: 'fake-standard' }
  }
}
