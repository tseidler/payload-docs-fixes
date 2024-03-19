import type { RichTextAdapter } from 'payload/types'

import { mapFields } from '@payloadcms/ui/utilities/buildComponentMap'
import { sanitizeFields } from 'payload/config'
import React from 'react'

import type { ResolvedServerFeatureMap } from './field/features/types.js'
import type { GeneratedFeatureProviderComponent } from './types.js'

import { cloneDeep } from './field/lexical/utils/cloneDeep.js'

export const getGenerateComponentMap =
  (args: {
    resolvedFeatureMap: ResolvedServerFeatureMap
  }): RichTextAdapter['generateComponentMap'] =>
  ({ config, schemaPath }) => {
    const validRelationships = config.collections.map((c) => c.slug) || []

    const componentMap = new Map()

    // turn args.resolvedFeatureMap into an array of [key, value] pairs, ordered by value.order, lowest order first:
    const resolvedFeatureMapArray = Array.from(args.resolvedFeatureMap.entries()).sort(
      (a, b) => a[1].order - b[1].order,
    )

    componentMap.set(
      `features`,
      resolvedFeatureMapArray
        .map(([featureKey, resolvedFeature]) => {
          const ClientComponent = resolvedFeature.ClientComponent
          const clientComponentProps = resolvedFeature.clientFeatureProps

          /**
           * Handle Feature Component Maps
           */
          if (
            'generateComponentMap' in resolvedFeature &&
            typeof resolvedFeature.generateComponentMap === 'function'
          ) {
            const components = resolvedFeature.generateComponentMap({
              config,
              props: resolvedFeature.serverFeatureProps,
              schemaPath,
            })

            for (const componentKey in components) {
              const Component = components[componentKey]
              if (Component) {
                componentMap.set(
                  `feature.${featureKey}.components.${componentKey}`,
                  <Component
                    componentKey={componentKey}
                    featureKey={resolvedFeature.key}
                    key={`${resolvedFeature.key}-${componentKey}`}
                  />,
                )
              }
            }
          }

          /**
           * Handle Feature Schema Maps (rendered fields)
           */
          if (
            'generateSchemaMap' in resolvedFeature &&
            typeof resolvedFeature.generateSchemaMap === 'function'
          ) {
            const schemas = resolvedFeature.generateSchemaMap({
              config,
              props: resolvedFeature.serverFeatureProps,
              schemaMap: new Map(),
              schemaPath,
            })

            for (const schemaKey in schemas) {
              const fields = schemas[schemaKey]

              const sanitizedFields = sanitizeFields({
                config,
                fields: cloneDeep(fields),
                validRelationships,
              })

              const mappedFields = mapFields({
                config,
                disableAddingID: true,
                fieldSchema: sanitizedFields,
                parentPath: `${schemaPath}.feature.${featureKey}.fields.${schemaKey}`,
                readOnly: false,
              })

              componentMap.set(`feature.${featureKey}.fields.${schemaKey}`, mappedFields)
            }
          }

          if (!ClientComponent) {
            return null
          }

          return {
            ClientComponent:
              clientComponentProps && typeof clientComponentProps === 'object' ? (
                <ClientComponent
                  {...clientComponentProps}
                  featureKey={resolvedFeature.key}
                  key={resolvedFeature.key}
                  order={resolvedFeature.order}
                />
              ) : (
                <ClientComponent
                  featureKey={resolvedFeature.key}
                  key={resolvedFeature.key}
                  order={resolvedFeature.order}
                />
              ),
            key: resolvedFeature.key,
            order: resolvedFeature.order,
          } as GeneratedFeatureProviderComponent
        })
        .filter((feature) => feature !== null),
    )

    return componentMap
  }
