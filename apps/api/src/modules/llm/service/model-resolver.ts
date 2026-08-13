export function resolveModel(
  model: 'standard',
  standardProviderModel = 'fake-standard',
): { providerModel: string } {
  switch (model) {
    case 'standard':
      return { providerModel: standardProviderModel }
  }
}
