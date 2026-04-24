import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import {
  ExperimentVariant,
  SavingsExperiment,
} from './entities/savings-experiment.entity';
import { SavingsExperimentAssignment } from './entities/savings-experiment-assignment.entity';

interface VariantDashboard {
  key: string;
  assignments: number;
  conversions: number;
  conversionRate: number;
  totalConversionValue: number;
}

@Injectable()
export class ExperimentsService {
  constructor(
    @InjectRepository(SavingsExperiment)
    private readonly experimentRepository: Repository<SavingsExperiment>,
    @InjectRepository(SavingsExperimentAssignment)
    private readonly assignmentRepository: Repository<SavingsExperimentAssignment>,
  ) {}

  async createExperiment(input: {
    key: string;
    name: string;
    description?: string;
    productId?: string;
    variants: ExperimentVariant[];
    configuration?: Record<string, any>;
    minSampleSize?: number;
    confidenceLevel?: number;
    status?: SavingsExperiment['status'];
  }): Promise<SavingsExperiment> {
    this.validateVariants(input.variants);

    const experiment = this.experimentRepository.create({
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      productId: input.productId ?? null,
      variants: input.variants,
      configuration: input.configuration ?? null,
      minSampleSize: input.minSampleSize ?? 100,
      confidenceLevel: input.confidenceLevel ?? 0.95,
      status: input.status ?? 'DRAFT',
      startedAt: input.status === 'ACTIVE' ? new Date() : null,
    });

    return await this.experimentRepository.save(experiment);
  }

  async listExperiments(): Promise<SavingsExperiment[]> {
    return await this.experimentRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async assignUser(experimentId: string, userId: string) {
    const experiment = await this.findExperiment(experimentId);
    if (experiment.status !== 'ACTIVE') {
      throw new BadRequestException('Experiment is not active');
    }

    const existing = await this.assignmentRepository.findOneBy({
      experimentId,
      userId,
    });
    if (existing) {
      return existing;
    }

    const variantKey = this.pickVariant(experiment, userId);
    const assignment = this.assignmentRepository.create({
      experimentId,
      userId,
      variantKey,
      convertedAt: null,
      conversionValue: 0,
      metadata: null,
    });

    return await this.assignmentRepository.save(assignment);
  }

  async trackConversion(
    experimentId: string,
    userId: string,
    value = 1,
    metadata?: Record<string, any>,
  ): Promise<SavingsExperimentAssignment> {
    const assignment = await this.assignmentRepository.findOneBy({
      experimentId,
      userId,
    });

    if (!assignment) {
      throw new NotFoundException('Experiment assignment not found');
    }

    assignment.convertedAt = assignment.convertedAt ?? new Date();
    assignment.conversionValue = value;
    assignment.metadata = metadata ?? assignment.metadata;

    return await this.assignmentRepository.save(assignment);
  }

  async getDashboard(experimentId: string) {
    const experiment = await this.findExperiment(experimentId);
    const assignments = await this.assignmentRepository.find({
      where: { experimentId },
    });

    const variants = experiment.variants.map((variant) =>
      this.buildVariantDashboard(variant, assignments),
    );

    const rankedVariants = [...variants].sort(
      (left, right) => right.conversionRate - left.conversionRate,
    );
    const [bestVariant, baselineVariant] = rankedVariants;
    const significance =
      bestVariant && baselineVariant && bestVariant.key !== baselineVariant.key
        ? this.calculateSignificance(
            baselineVariant,
            bestVariant,
            Number(experiment.confidenceLevel ?? 0.95),
          )
        : null;

    return {
      experimentId: experiment.id,
      key: experiment.key,
      name: experiment.name,
      status: experiment.status,
      minSampleSize: experiment.minSampleSize,
      confidenceLevel: Number(experiment.confidenceLevel ?? 0.95),
      variants,
      significance,
    };
  }

  private async findExperiment(
    experimentId: string,
  ): Promise<SavingsExperiment> {
    const experiment = await this.experimentRepository.findOneBy({
      id: experimentId,
    });
    if (!experiment) {
      throw new NotFoundException(`Experiment ${experimentId} not found`);
    }
    return experiment;
  }

  private validateVariants(variants: ExperimentVariant[]) {
    if (!variants.length || variants.length < 2) {
      throw new BadRequestException(
        'Experiments require at least two variants',
      );
    }

    const seen = new Set<string>();
    for (const variant of variants) {
      if (!variant.key || seen.has(variant.key)) {
        throw new BadRequestException(
          'Variant keys must be unique and non-empty',
        );
      }
      if (variant.weight <= 0) {
        throw new BadRequestException('Variant weights must be positive');
      }
      seen.add(variant.key);
    }
  }

  private pickVariant(experiment: SavingsExperiment, userId: string): string {
    const digest = createHash('sha256')
      .update(`${experiment.id}:${userId}`)
      .digest('hex');
    const ratio = parseInt(digest.slice(0, 8), 16) / 0xffffffff;
    const totalWeight = experiment.variants.reduce(
      (sum, variant) => sum + variant.weight,
      0,
    );

    let cursor = 0;
    for (const variant of experiment.variants) {
      cursor += variant.weight / totalWeight;
      if (ratio <= cursor) {
        return variant.key;
      }
    }

    return experiment.variants[experiment.variants.length - 1].key;
  }

  private buildVariantDashboard(
    variant: ExperimentVariant,
    assignments: SavingsExperimentAssignment[],
  ): VariantDashboard {
    const variantAssignments = assignments.filter(
      (assignment) => assignment.variantKey === variant.key,
    );
    const conversions = variantAssignments.filter(
      (assignment) => assignment.convertedAt != null,
    );
    const assignmentCount = variantAssignments.length;
    const conversionCount = conversions.length;

    return {
      key: variant.key,
      assignments: assignmentCount,
      conversions: conversionCount,
      conversionRate:
        assignmentCount > 0
          ? Number(((conversionCount / assignmentCount) * 100).toFixed(2))
          : 0,
      totalConversionValue: Number(
        conversions
          .reduce(
            (sum, assignment) => sum + Number(assignment.conversionValue ?? 0),
            0,
          )
          .toFixed(2),
      ),
    };
  }

  private calculateSignificance(
    baseline: VariantDashboard,
    challenger: VariantDashboard,
    confidenceLevel: number,
  ) {
    const p1 = baseline.assignments
      ? baseline.conversions / baseline.assignments
      : 0;
    const p2 = challenger.assignments
      ? challenger.conversions / challenger.assignments
      : 0;
    const pooled =
      baseline.assignments + challenger.assignments > 0
        ? (baseline.conversions + challenger.conversions) /
          (baseline.assignments + challenger.assignments)
        : 0;
    const standardError = Math.sqrt(
      pooled *
        (1 - pooled) *
        ((baseline.assignments ? 1 / baseline.assignments : 0) +
          (challenger.assignments ? 1 / challenger.assignments : 0)),
    );
    const zScore = standardError > 0 ? (p2 - p1) / standardError : 0;
    const confidence = Number(
      (this.normalCdf(Math.abs(zScore)) * 100).toFixed(2),
    );

    return {
      baselineVariant: baseline.key,
      challengerVariant: challenger.key,
      zScore: Number(zScore.toFixed(4)),
      confidence,
      statisticallySignificant:
        confidence >= Number((confidenceLevel * 100).toFixed(2)) &&
        baseline.assignments >= 1 &&
        challenger.assignments >= 1,
    };
  }

  private normalCdf(value: number): number {
    return 0.5 * (1 + this.erf(value / Math.sqrt(2)));
  }

  private erf(value: number): number {
    const sign = value >= 0 ? 1 : -1;
    const x = Math.abs(value);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y =
      1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }
}
