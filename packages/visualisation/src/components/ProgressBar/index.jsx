import React from 'react'
import styled from 'styled-components'

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
`

const Container = styled.div`
  height: 8px;
  width: 100%;
  background-color: #e0e0de;
  border-radius: 4px;
  overflow: hidden;
`

const Filler = styled.div`
  height: 100%;
  width: ${(props) => `${props.completed}%`};
  background-color: ${(props) => props.color || '#13c57b'};
  transition: width 0.5s ease-in-out;
`

const ProgressBar = ({ completed, color }) => {
  return (
    <Wrapper>
      <Container>
        <Filler completed={completed} color={color} />
      </Container>
    </Wrapper>
  )
}

export default ProgressBar
