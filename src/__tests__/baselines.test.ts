import createTransformer from '../createTransformer';
import { expectBaselineTransforms } from './expectTransform';

const transformer = createTransformer();

expectBaselineTransforms(transformer, __dirname + '/baselines');
