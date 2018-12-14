import * as React from 'react';
import styled, { css } from '../../utils/styled';
import { IconLink } from '../../components/IconLink';
import { ActionLink } from '../../components/ActionLink';
import { Condition } from './types';
import { ui5, ui4 } from '../../colors';
import { distance } from '../../distance';
import { ConditionRow } from './ConditionRow.part';
import { SharedRuleComponentProps } from './RuleEditor.types';
import { strings } from './constants';
import { Icon } from '../../components/Icon';
import { transparentize } from '../../utils/colors';

export interface ConditionGroupProps extends SharedRuleComponentProps {
  level: number;
  maxLevels?: number;
  conditions?: Array<Condition>;
  operators: Array<string>;
  onTypeClick(ref?: Array<Condition>): void;
  onRemoveGroup?(ref?: Array<Condition>): void;
  type: string;
  root: boolean;
  rootHovered?: boolean;
}

export interface OpacityContainerProps {
  rootHovered: boolean;
}

const inactiveOpacity = 0.5;
const defaultBorderStyle = `1px solid ${ui5}`;

const GroupButton = styled.div`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  min-width: 22px;
`;

const RemoveGroupBtn = GroupButton.extend`
  border-left: ${defaultBorderStyle};
  border-bottom: ${defaultBorderStyle};
  top: 0;
  right: 0;
`;

const ToggleGroupTypeBtn = GroupButton.extend`
  border-right: ${defaultBorderStyle};
  border-bottom: ${defaultBorderStyle};
  top: 0;
  left: 0;
`;

const ConditionRowWithRootHovered = css`
  opacity: ${inactiveOpacity};
`;

const ConditionRowWithoutRootHovered = css`
  opacity: 1;
`;

const StyledConditionRow = styled.div`
  ${({ rootHovered }: OpacityContainerProps) =>
    rootHovered ? ConditionRowWithRootHovered : ConditionRowWithoutRootHovered}
`;

const ControlsContainerWhenRootHovered = css`
  ${ToggleGroupTypeBtn}, ${RemoveGroupBtn} {
    border-color: ${transparentize(ui4, 0.7)};
  }

  opacity: ${inactiveOpacity};
`;

const ControlsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: left;

  ${({ rootHovered }: OpacityContainerProps) => (rootHovered ? ControlsContainerWhenRootHovered : ``)}
`;

const ContainerWithRootHovered = css`
  border: 1px solid ${transparentize(ui4, 0.7)};

  &:hover {
    > ${StyledConditionRow} {
      opacity: 1;
    }

    > ${ControlsContainer} {
      ${ToggleGroupTypeBtn}, ${RemoveGroupBtn} {
        border-color: ${ui5};
      }

      opacity: 1;
    }

    border: ${defaultBorderStyle};
  }
`;

const ContainerWithoutRootHovered = css`
  border: ${defaultBorderStyle};
`;

const Container = styled.div`
  padding: 38px ${distance.medium} ${distance.medium};
  margin-bottom: ${distance.medium};
  position: relative;

  ${({ rootHovered }: OpacityContainerProps) => (rootHovered ? ContainerWithRootHovered : ContainerWithoutRootHovered)}
`;

const StyledIconLink = styled(IconLink)`
  margin-right: ${distance.medium};
`;

const TypeSwitch = styled(ActionLink)`
  padding: 5px;
  font-size: 12px;
  color: ${ui5};
`;

const RemoveIcon = styled(Icon)`
  cursor: pointer;
`;

const defaultBaseCondition = {
  fact: '',
  operator: 'equal',
  value: '',
};

export class ConditionGroup extends React.Component<ConditionGroupProps> {
  private tryToTranslate = (key: string) => {
    const { translate } = this.props;
    return (translate && translate(key)) || strings[key] || `__missing__${key}`;
  };

  private removeCondition = (ref: Condition) => {
    const { conditions, changeCondition } = this.props;

    if (conditions) {
      const nextCondition = [...conditions];

      for (const key in conditions) {
        const condition = conditions[key];

        if (condition === ref) {
          nextCondition.splice(parseInt(key, 10), 1);
        }
      }

      changeCondition(conditions, nextCondition);
    }
  };

  private addGroup = () => {
    const { conditions, changeCondition } = this.props;

    if (conditions && Array.isArray(conditions)) {
      changeCondition(conditions, [...conditions, { all: [] }]);
    }
  };

  private removeGroup = (ref?: Condition) => {
    const { conditions, changeCondition } = this.props;

    if (ref && conditions && Array.isArray(conditions)) {
      const nextCondition = [...conditions];

      for (const key in conditions) {
        const condition = conditions[key];

        if (condition === ref) {
          nextCondition.splice(parseInt(key, 10), 1);
        }
      }

      changeCondition(conditions, nextCondition);
    }
  };

  private addCondition = (condition = { ...defaultBaseCondition }) => {
    const { conditions, changeCondition } = this.props;

    if (conditions && Array.isArray(conditions)) {
      changeCondition(conditions, [...conditions, condition]);
    }
  };

  private handleTypeChange = (ref?: Condition) => {
    const { conditions, changeCondition } = this.props;

    if (conditions && ref) {
      const nextCondition = [...conditions];
      const tempCondition = { ...ref };

      for (const key in conditions) {
        const condition = conditions[key] as Condition;

        if (condition === ref) {
          if (condition.any) {
            nextCondition[key].all = tempCondition.all || tempCondition.any;
            delete nextCondition[key].any;
          } else {
            nextCondition[key].any = tempCondition.any || tempCondition.all;
            delete nextCondition[key].all;
          }
        }
      }
      changeCondition(conditions, nextCondition);
    }
  };

  private emptyCondition = () => {
    const { conditions } = this.props;
    return conditions && Object.keys(conditions).length <= 0;
  };

  private changeConditionProxy = (ref: Object, value?: any) => {
    const { changeCondition } = this.props;

    if (!this.emptyCondition()) {
      changeCondition(ref, value);
    } else {
      this.addCondition({ ...defaultBaseCondition, ...value });
    }
  };

  private renderConditionRow = (condition: Condition, key: string) => {
    const { operators, facts, translate, valueRenderer, rootHovered = false } = this.props;

    return (
      <StyledConditionRow rootHovered={rootHovered} key={key}>
        <ConditionRow
          tryToTranslate={this.tryToTranslate}
          operators={operators}
          condition={condition}
          onRemoveCondition={this.removeCondition}
          changeCondition={this.changeConditionProxy}
          translate={translate}
          valueRenderer={valueRenderer}
          facts={facts}
        />
      </StyledConditionRow>
    );
  };

  render(): JSX.Element {
    const {
      facts,
      conditions,
      operators,
      onTypeClick,
      onRemoveGroup,
      type,
      root,
      rootHovered = false,
      maxLevels,
      level,
      ...rest
    } = this.props;

    const showAddGroupBtn = !maxLevels ? true : level < maxLevels;

    return (
      <Container rootHovered={rootHovered}>
        {conditions &&
          conditions.map((condition: Condition, index) =>
            condition.any || condition.all ? (
              <ConditionGroup
                key={`condition-group-${index}`}
                facts={facts}
                conditions={condition.any || condition.all}
                operators={operators}
                onTypeClick={() => this.handleTypeChange(condition)}
                onRemoveGroup={() => this.removeGroup(condition)}
                type={condition.any ? 'any' : 'all'}
                root={false}
                rootHovered={rootHovered}
                maxLevels={maxLevels}
                level={level + 1}
                {...rest}
              />
            ) : (
              this.renderConditionRow(condition, `condition-${index}`)
            ),
          )}
        {this.emptyCondition() && this.renderConditionRow({ ...defaultBaseCondition }, 'ghost-condition')}
        <ControlsContainer rootHovered={rootHovered}>
          <StyledIconLink icon="Add" onClick={() => this.addCondition()}>
            {this.tryToTranslate('condition')}
          </StyledIconLink>
          {showAddGroupBtn && (
            <StyledIconLink icon="Add" onClick={this.addGroup}>
              {this.tryToTranslate('group')}
            </StyledIconLink>
          )}
          {conditions && !root && onRemoveGroup && (
            <RemoveGroupBtn>
              <RemoveIcon name="Delete" onClick={() => onRemoveGroup(conditions)} color={ui5} />
            </RemoveGroupBtn>
          )}
          <ToggleGroupTypeBtn>
            <TypeSwitch onClick={() => onTypeClick(conditions)}>{this.tryToTranslate(type)}</TypeSwitch>
          </ToggleGroupTypeBtn>
        </ControlsContainer>
      </Container>
    );
  }
}
