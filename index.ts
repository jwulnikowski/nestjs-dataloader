import DataLoader from 'dataloader';
import { NestInterceptor, ExecutionContext, CallHandler, InternalServerErrorException, createParamDecorator } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ModuleRef, APP_INTERCEPTOR } from '@nestjs/core';
import { GqlExecutionContext, GraphQLExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';

/**
 * This interface will be used to generate the initial data loader.
 * The concrete implementation should be added as a 
 */
export interface NestDataLoader<ID extends (string | number), Type> {
    /**
     * Should return a new instance of dataloader each time
     */
    generateDataLoader(): DataLoader<ID, Type>;
}

/**
 * Context key where get loader function will be stored.
 * This class should be added to your module providers like so:
 * {
 *     provide: APP_INTERCEPTOR,
 *     useClass: DataLoaderInterceptor,
 * },
 */
export const GET_LOADER_CONTEXT_KEY: string = 'GET_LOADER_CONTEXT_KEY';

@Injectable()
export class DataLoaderInterceptor implements NestInterceptor {

    constructor(
        private readonly moduleRef: ModuleRef,
    ) { }

    /**
     * @inheritdoc
     */
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const graphqlExecutionContext: GraphQLExecutionContext = GqlExecutionContext.create(context);
        const ctx: any = graphqlExecutionContext.getContext();

        if (ctx[GET_LOADER_CONTEXT_KEY] === undefined) {

            ctx[GET_LOADER_CONTEXT_KEY] = (type: string): NestDataLoader<any, any> => {

                if (ctx[type] === undefined) {
                    try {
                        ctx[type] = this.moduleRef
                            .get<NestDataLoader<any, any>>(type, { strict: false })
                            .generateDataLoader();
                    } catch (e) {
                        throw new InternalServerErrorException(`The loader ${type} is not provided`);
                    }
                }

                return ctx[type];
            };
        }
        return next.handle();
    }
}

/**
 * The decorator to be used within your graphql method.
 */
export const Loader = createParamDecorator(
    (data: string, [_, __, ctx]) => {

        if (ctx[GET_LOADER_CONTEXT_KEY] === undefined) {
            throw new InternalServerErrorException(`
            You should provide interceptor ${DataLoaderInterceptor.name} globaly with ${APP_INTERCEPTOR}
          `);
        }

        return ctx[GET_LOADER_CONTEXT_KEY](data);
    },
);